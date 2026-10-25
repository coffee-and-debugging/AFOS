const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { orderInclude, getSettings, computeTotals, applyRecipeStock, createOrder } = require('../lib/orders');
const { notifyLowStock } = require('../lib/stock');
const events = require('../lib/events');

const router = express.Router();

const STATUSES = ['pending', 'cooking', 'serving', 'completed', 'cancelled'];
const STAFF_METHODS = ['cash', 'card', 'esewa', 'khalti'];

/** Pushes a new order to the kitchen and front desk, plus any low-stock alerts it caused. */
function announceNewOrder({ order, stockAlerts }) {
  events.publish('order.created', order);
  notifyLowStock(stockAlerts, { orderId: order.id, billNo: order.billNo });
  return order;
}

function parseDate(value, name) {
  if (!value) return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${name} is not a valid date`);
  return d;
}

// List orders — staff. Filters: from, to, status, type, tableId, unpaid, limit
router.get('/', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  const { status, type, tableId, unpaid } = req.query;
  const from = parseDate(req.query.from, 'from');
  const to = parseDate(req.query.to, 'to');
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 500, 2000);

  const orders = await prisma.order.findMany({
    where: {
      ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: to }) } }),
      ...(status && { status: String(status) }),
      ...(type && { type: String(type) }),
      ...(tableId && { tableId: String(tableId) }),
      ...(unpaid === 'true' && { paymentStatus: { not: 'paid' }, status: { not: 'cancelled' } }),
    },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(orders);
}));

// Single order — public so guests can track by the unguessable id.
router.get('/:id', asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(order);
}));

// Guest order from a table QR code
router.post('/', asyncHandler(async (req, res) => {
  const { tableId, items, customerNote } = req.body || {};
  if (!tableId) throw new HttpError(400, 'Table is required');
  const created = await prisma.$transaction((tx) =>
    createOrder(tx, { items, type: 'dine_in', source: 'qr', tableId, customerNote }));
  res.status(201).json(announceNewOrder(created));
}));

// Staff order from the POS; optionally paid immediately
router.post('/pos', requireAuth(ROLES.FRONT), asyncHandler(async (req, res) => {
  const { items, type, tableId, customerNote, discount, payWith } = req.body || {};
  if (payWith && !STAFF_METHODS.includes(payWith)) throw new HttpError(400, 'Unknown payment method');

  const created = await prisma.$transaction(async (tx) => {
    const result = await createOrder(tx, { items, type, source: 'pos', tableId, customerNote, discount });
    if (!payWith) return result;
    const order = await tx.order.update({
      where: { id: result.order.id },
      data: { paymentStatus: 'paid', paymentMethod: payWith, paidAt: new Date() },
      include: orderInclude,
    });
    return { ...result, order };
  });
  res.status(201).json(announceNewOrder(created));
}));

router.put('/:id/status', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) throw new HttpError(400, `Status must be one of: ${STATUSES.join(', ')}`);

  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!existing) throw new HttpError(404, 'Order not found');
    if (existing.status === 'cancelled') throw new HttpError(409, 'This order was cancelled');

    if (status === 'cancelled') {
      if (req.user.role === 'chef') throw new HttpError(403, 'Only the front desk can cancel orders');
      if (existing.paymentStatus === 'paid') throw new HttpError(409, 'Paid orders cannot be cancelled');
      await applyRecipeStock(tx, existing.items, 1, 'cancel', existing.id);
    }
    return tx.order.update({ where: { id: existing.id }, data: { status }, include: orderInclude });
  });
  events.publish('order.updated', order);
  res.json(order);
}));

// Guest chooses "pay at the counter". Online payments go through /api/payments and are
// marked paid only after eSewa/Khalti confirm them.
router.post('/:id/payment', asyncHandler(async (req, res) => {
  const { method } = req.body || {};
  if (method !== 'counter') throw new HttpError(400, 'Pay online with eSewa or Khalti from the payment screen');

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Order not found');
  if (existing.paymentStatus === 'paid') throw new HttpError(400, 'This order is already paid');
  if (existing.status === 'cancelled') throw new HttpError(409, 'This order was cancelled');

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: { paymentMethod: 'counter', paymentStatus: 'pending_counter' },
    include: orderInclude,
  });
  events.publish('order.updated', order);
  res.json(order);
}));

// Settle a bill at the counter — front desk. Optional discount is applied before charging.
router.post('/:id/pay', requireAuth(ROLES.FRONT), asyncHandler(async (req, res) => {
  const { method, discount } = req.body || {};
  if (!STAFF_METHODS.includes(method)) throw new HttpError(400, 'Choose cash, card, eSewa or Khalti');

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Order not found');
  if (existing.paymentStatus === 'paid') throw new HttpError(400, 'This order is already paid');
  if (existing.status === 'cancelled') throw new HttpError(409, 'This order was cancelled');

  const totals = discount === undefined
    ? {}
    : computeTotals(existing.subtotal, discount, existing.type, await getSettings(prisma));

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: { ...totals, paymentStatus: 'paid', paymentMethod: method, paidAt: new Date() },
    include: orderInclude,
  });
  events.publish('order.updated', order);
  res.json(order);
}));

module.exports = router;
