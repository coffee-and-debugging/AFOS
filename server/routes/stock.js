const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');

const router = express.Router();

const ADJUST_REASONS = ['adjustment', 'wastage'];

function num(value, name, { min = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new HttpError(400, `${name} must be a number of at least ${min}`);
  return n;
}

function parseItem(body = {}) {
  const name = String(body.name || '').trim();
  const unit = String(body.unit || '').trim();
  if (!name) throw new HttpError(400, 'Item name is required');
  if (!unit) throw new HttpError(400, 'Unit is required (e.g. kg, pcs, L)');
  return {
    name,
    unit,
    reorderLevel: num(body.reorderLevel ?? 0, 'Reorder level'),
    costPerUnit: num(body.costPerUnit ?? 0, 'Cost per unit'),
  };
}

router.get('/', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } });
  res.json(items.map((i) => ({ ...i, lowStock: i.quantity <= i.reorderLevel })));
}));

router.post('/', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const data = parseItem(req.body);
  const opening = num(req.body?.quantity ?? 0, 'Opening quantity');
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.stockItem.create({ data: { ...data, quantity: opening } });
    if (opening > 0) {
      await tx.stockMovement.create({ data: { stockItemId: created.id, change: opening, reason: 'adjustment', note: 'Opening stock' } });
    }
    return created;
  });
  res.status(201).json({ ...item, lowStock: item.quantity <= item.reorderLevel });
}));

// Quantity is never edited directly — use /adjust or a purchase so every change is logged.
router.put('/:id', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const item = await prisma.stockItem.update({ where: { id: Number(req.params.id) }, data: parseItem(req.body) });
  res.json({ ...item, lowStock: item.quantity <= item.reorderLevel });
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
router.post('/:id/adjust', requireAuth(ROLES.KITCHEN), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const change = Number(req.body?.change);
  const reason = req.body?.reason || 'adjustment';
  if (!Number.isFinite(change) || change === 0) throw new HttpError(400, 'Enter a quantity to add or remove');
  if (!ADJUST_REASONS.includes(reason)) throw new HttpError(400, 'Reason must be adjustment or wastage');
  if (reason === 'wastage' && change > 0) throw new HttpError(400, 'Wastage must remove stock');

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.stockItem.update({ where: { id }, data: { quantity: { increment: change } } });
    await tx.stockMovement.create({
      data: { stockItemId: id, change, reason, note: `${String(req.body?.note || '').slice(0, 200)} (by ${req.user.name})`.trim() },
    });
    return updated;
  });
  res.json({ ...item, lowStock: item.quantity <= item.reorderLevel });
}));

router.get('/:id/movements', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  res.json(await prisma.stockMovement.findMany({
    where: { stockItemId: Number(req.params.id) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }));
}));

module.exports = router;
