const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { round } = require('../lib/orders');
const { round3, toBaseUnits, changeStock, notifyLowStock } = require('../lib/stock');

const router = express.Router();
router.use(requireAuth(ROLES.ADMIN));

const include = {
  supplier: { select: { id: true, name: true } },
  items: { include: { stockItem: { select: { name: true, unit: true } } } },
};

router.get('/', asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  res.json(await prisma.purchase.findMany({
    where: (from || to) ? { date: { ...(from && { gte: from }), ...(to && { lt: to }) } } : undefined,
    include,
    orderBy: { date: 'desc' },
    take: 500,
  }));
}));

// Recording a purchase adds the goods to stock and updates each item's latest cost.
// A line with `inPacks: true` gives quantity and unit cost per pack; it is stored in base units
// (2 packs × Rs. 400 of a 20-pcs pack → 40 pcs × Rs. 20) so loose-unit sales deduct correctly.
router.post('/', asyncHandler(async (req, res) => {
  const { supplierId, invoiceNo, date, notes, paymentStatus = 'paid', items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Add at least one item');
  if (!['paid', 'unpaid'].includes(paymentStatus)) throw new HttpError(400, 'Payment status must be paid or unpaid');

  const stockItems = await prisma.stockItem.findMany({ where: { id: { in: items.map((i) => Number(i.stockItemId)).filter(Number.isInteger) } } });
  const lines = items.map((i) => {
    const stockItemId = Number(i.stockItemId);
    const entered = Number(i.quantity);
    const enteredCost = Number(i.unitCost);
    if (!Number.isInteger(stockItemId)) throw new HttpError(400, 'Choose a stock item for every line');
    if (!(entered > 0)) throw new HttpError(400, 'Quantities must be greater than zero');
    if (!(enteredCost >= 0)) throw new HttpError(400, 'Unit cost cannot be negative');
    const stockItem = stockItems.find((s) => s.id === stockItemId);
    if (!stockItem) throw new HttpError(400, 'One of the stock items no longer exists');
    const subtotal = round(entered * enteredCost);
    const quantity = toBaseUnits(stockItem, entered, Boolean(i.inPacks));
    return { stockItemId, quantity, unitCost: quantity ? subtotal / quantity : 0, subtotal };
  });
  const when = date ? new Date(date) : new Date();
  if (Number.isNaN(when.getTime())) throw new HttpError(400, 'Purchase date is not valid');

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        supplierId: supplierId || null,
        invoiceNo: String(invoiceNo || '').trim(),
        date: when,
        notes: String(notes || '').trim(),
        paymentStatus,
        totalAmount: round(lines.reduce((s, l) => s + l.subtotal, 0)),
        items: { create: lines },
      },
      include,
    });
    for (const l of lines) {
      await tx.stockItem.update({
        where: { id: l.stockItemId },
        data: { quantity: { increment: l.quantity }, costPerUnit: l.unitCost },
      });
      await tx.stockMovement.create({
        data: { stockItemId: l.stockItemId, change: l.quantity, reason: 'purchase', refId: created.id, note: created.invoiceNo },
      });
    }
    return created;
  });
  res.status(201).json(purchase);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body || {};
  if (!['paid', 'unpaid'].includes(paymentStatus)) throw new HttpError(400, 'Payment status must be paid or unpaid');
  res.json(await prisma.purchase.update({ where: { id: req.params.id }, data: { paymentStatus }, include }));
}));

// Voiding a purchase takes its goods back out of stock.
router.delete('/:id', asyncHandler(async (req, res) => {
  const alerts = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!purchase) throw new HttpError(404, 'Purchase not found');
    const found = [];
    for (const l of purchase.items) {
      const { alert } = await changeStock(tx, l.stockItemId, round3(-l.quantity), { reason: 'purchase_void', refId: purchase.id });
      found.push(alert);
    }
    await tx.purchase.delete({ where: { id: purchase.id } });
    return found;
  });
  notifyLowStock(alerts, { purchaseVoided: req.params.id });
  res.json({ success: true });
}));

module.exports = router;
