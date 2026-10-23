const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { round3, isLow, serializeStock, toBaseUnits, changeStock, notifyLowStock } = require('../lib/stock');

const router = express.Router();

const ADJUST_REASONS = ['adjustment', 'wastage'];

function num(value, name, { min = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new HttpError(400, `${name} must be a number of at least ${min}`);
  return n;
}

/** Optional pack definition: both a pack name and a size, or neither. */
function parsePack(body) {
  const packUnit = String(body.packUnit || '').trim();
  const hasSize = body.unitsPerPack !== undefined && body.unitsPerPack !== null && body.unitsPerPack !== '';
  if (!packUnit && !hasSize) return { packUnit: null, unitsPerPack: null };
  if (!packUnit) throw new HttpError(400, 'Name the pack unit (e.g. pack, box, crate)');
  const unitsPerPack = Number(body.unitsPerPack);
  if (!(unitsPerPack > 0)) throw new HttpError(400, 'Units per pack must be greater than zero');
  return { packUnit, unitsPerPack };
}

function parseItem(body = {}) {
  const name = String(body.name || '').trim();
  const unit = String(body.unit || '').trim();
  if (!name) throw new HttpError(400, 'Item name is required');
  if (!unit) throw new HttpError(400, 'Unit is required (e.g. kg, pcs, L)');
  const pack = parsePack(body);
  if (pack.packUnit && pack.packUnit.toLowerCase() === unit.toLowerCase()) {
    throw new HttpError(400, 'The pack unit must differ from the base unit');
  }
  return {
    name,
    unit,
    ...pack,
    reorderLevel: num(body.reorderLevel ?? 0, 'Reorder level'),
    costPerUnit: num(body.costPerUnit ?? 0, 'Cost per unit'),
  };
}

router.get('/', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } });
  res.json(items.map(serializeStock));
}));

// Everything currently at or below its reorder level — seeds the live alert bell on staff screens.
router.get('/low', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  const items = await prisma.stockItem.findMany({ orderBy: { quantity: 'asc' } });
  res.json(items.filter(isLow).map(serializeStock));
}));

router.post('/', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const data = parseItem(req.body);
  const opening = toBaseUnits(data, num(req.body?.quantity ?? 0, 'Opening quantity'), Boolean(req.body?.inPacks));
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.stockItem.create({ data: { ...data, quantity: opening } });
    if (opening > 0) {
      await tx.stockMovement.create({ data: { stockItemId: created.id, change: opening, reason: 'adjustment', note: 'Opening stock' } });
    }
    return created;
  });
  res.status(201).json(serializeStock(item));
}));

// Quantity is never edited directly — use /adjust or a purchase so every change is logged.
router.put('/:id', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const data = parseItem(req.body);
  const existing = await prisma.stockItem.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Stock item not found');
  // Renaming the base unit would silently reinterpret every quantity; that needs /convert.
  const hasHistory = existing.quantity !== 0
    || (await prisma.stockMovement.count({ where: { stockItemId: id } })) > 0
    || (await prisma.recipeItem.count({ where: { stockItemId: id } })) > 0;
  if (existing.unit !== data.unit && hasHistory) {
    throw new HttpError(409, `Use "Convert units" to change ${existing.unit} to ${data.unit} so quantities and recipes are rescaled`);
  }
  const item = await prisma.stockItem.update({ where: { id }, data });
  res.json(serializeStock(item));
}));

router.delete('/:id', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (await prisma.purchaseItem.count({ where: { stockItemId: id } })) {
    throw new HttpError(409, 'This item appears on purchases and cannot be deleted');
  }
  await prisma.stockItem.delete({ where: { id } });
  res.json({ success: true });
}));

// Manual correction or wastage. Positive change adds stock, negative removes it.
// `inPacks: true` means `change` is counted in packs and is converted to base units.
router.post('/:id/adjust', requireAuth(ROLES.KITCHEN), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const reason = req.body?.reason || 'adjustment';
  const entered = Number(req.body?.change);
  if (!Number.isFinite(entered) || entered === 0) throw new HttpError(400, 'Enter a quantity to add or remove');
  if (!ADJUST_REASONS.includes(reason)) throw new HttpError(400, 'Reason must be adjustment or wastage');
  if (reason === 'wastage' && entered > 0) throw new HttpError(400, 'Wastage must remove stock');

  const { item, alert } = await prisma.$transaction(async (tx) => {
    const existing = await tx.stockItem.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Stock item not found');
    const change = toBaseUnits(existing, entered, Boolean(req.body?.inPacks));
    const packNote = req.body?.inPacks ? ` [${entered} ${existing.packUnit}]` : '';
    const note = `${String(req.body?.note || '').slice(0, 200)}${packNote} (by ${req.user.name})`.trim();
    return changeStock(tx, id, change, { reason, note });
  });
  notifyLowStock([alert], { adjustedBy: req.user.name });
  res.json(serializeStock(item));
}));

/**
 * Re-bases an item onto a smaller unit, e.g. 12 "pack" → 240 "pcs" with 1 pack = 20 pcs.
 * Quantity, reorder level, cost, recipes, purchase lines and movement history are all
 * rescaled together, so history and cost-of-goods reports stay consistent.
 * Body: { unit: 'pcs', factor: 20, packUnit?: 'pack' } — factor = new units per old unit.
 */
router.post('/:id/convert', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const unit = String(req.body?.unit || '').trim();
  const factor = Number(req.body?.factor);
  if (!unit) throw new HttpError(400, 'Enter the new base unit (e.g. pcs)');
  if (!(factor > 0) || factor === 1) throw new HttpError(400, 'Conversion factor must be a positive number other than 1');

  const item = await prisma.$transaction(async (tx) => {
    const existing = await tx.stockItem.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Stock item not found');
    if (existing.unit === unit) throw new HttpError(400, `Already counted in ${unit}`);
    const packUnit = String(req.body?.packUnit ?? existing.unit).trim() || null;

    // Prisma has no multiply-by-column for many rows, so scale with SQL.
    await tx.$executeRaw`UPDATE "RecipeItem" SET quantity = quantity * ${factor} WHERE "stockItemId" = ${id}`;
    await tx.$executeRaw`UPDATE "StockMovement" SET change = change * ${factor} WHERE "stockItemId" = ${id}`;
    await tx.$executeRaw`UPDATE "PurchaseItem" SET quantity = quantity * ${factor}, "unitCost" = "unitCost" / ${factor} WHERE "stockItemId" = ${id}`;
    const updated = await tx.stockItem.update({
      where: { id },
      data: {
        unit,
        packUnit,
        unitsPerPack: packUnit ? factor : null,
        quantity: round3(existing.quantity * factor),
        reorderLevel: round3(existing.reorderLevel * factor),
        costPerUnit: existing.costPerUnit / factor,
      },
    });
    await tx.stockMovement.create({
      data: { stockItemId: id, change: 0, reason: 'adjustment', note: `Converted 1 ${existing.unit} → ${factor} ${unit} (by ${req.user.name})` },
    });
    return updated;
  });
  res.json(serializeStock(item));
}));

router.get('/:id/movements', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  res.json(await prisma.stockMovement.findMany({
    where: { stockItemId: Number(req.params.id) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }));
}));

module.exports = router;
