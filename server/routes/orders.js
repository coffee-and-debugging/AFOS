const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { round, orderInclude, getSettings, computeTotals, splitDiscount, applyRecipeStock, createOrder } = require('../lib/orders');
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
// Settle several orders in one go, e.g. every open bill of a table. One discount is split
// across them by subtotal. All or nothing: if any order can't be paid, none are.
router.post('/pay-many', requireAuth(ROLES.FRONT), asyncHandler(async (req, res) => {
  const { ids, method, discount } = req.body || {};
  if (!STAFF_METHODS.includes(method)) throw new HttpError(400, 'Choose cash, card, eSewa or Khalti');
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpError(400, 'Choose the orders to bill');
  const unique = [...new Set(ids.map(String))];

  const orders = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findMany({ where: { id: { in: unique } }, orderBy: { createdAt: 'asc' } });
    if (existing.length !== unique.length) throw new HttpError(404, 'One of the orders no longer exists');
    for (const o of existing) {
      if (o.paymentStatus === 'paid') throw new HttpError(400, `Bill #${String(o.billNo).padStart(5, '0')} is already paid`);
      if (o.status === 'cancelled') throw new HttpError(409, `Bill #${String(o.billNo).padStart(5, '0')} was cancelled`);
    }
    const settings = discount === undefined ? null : await getSettings(tx);
    const shares = discount === undefined ? [] : splitDiscount(existing.map((o) => o.subtotal), discount);
    const paidAt = new Date();
    const updated = [];
    for (const [i, o] of existing.entries()) {
      const totals = settings ? computeTotals(o.subtotal, shares[i], o.type, settings) : {};
      updated.push(await tx.order.update({
        where: { id: o.id },
        data: { ...totals, paymentStatus: 'paid', paymentMethod: method, paidAt },
        include: orderInclude,
      }));
    }
    return updated;
  });
  orders.forEach((o) => events.publish('order.updated', o));
  res.json(orders);
}));

// Pay for chosen items only (e.g. one guest at a table pays for their own dishes). Chosen items are
// split off into their own bill, which is charged; the rest stays on the original, still unpaid.
// Body: { lines: [{ orderItemId, quantity }], method, discount } — quantity may be part of a line.
router.post('/pay-items', requireAuth(ROLES.FRONT), asyncHandler(async (req, res) => {
  const { lines, method, discount } = req.body || {};
  if (!STAFF_METHODS.includes(method)) throw new HttpError(400, 'Choose cash, card, eSewa or Khalti');
  if (!Array.isArray(lines) || lines.length === 0) throw new HttpError(400, 'Choose the items to pay for');
  const wanted = new Map();
  for (const l of lines) {
    const qty = Number(l?.quantity);
    if (!Number.isInteger(qty) || qty < 1) throw new HttpError(400, 'Item quantities must be whole numbers');
    wanted.set(String(l.orderItemId), (wanted.get(String(l.orderItemId)) || 0) + qty);
  }

  const { paid, touched } = await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { id: { in: [...wanted.keys()] } }, include: { order: { include: { items: true } } } });
    if (items.length !== wanted.size) throw new HttpError(404, 'One of the items is no longer on the bill');
    const byOrder = new Map();
    for (const item of items) {
      const o = item.order;
      const label = `Bill #${String(o.billNo).padStart(5, '0')}`;
      if (o.paymentStatus === 'paid') throw new HttpError(400, `${label} is already paid`);
      if (o.status === 'cancelled') throw new HttpError(409, `${label} was cancelled`);
      if (wanted.get(item.id) > item.quantity) throw new HttpError(400, `Only ${item.quantity} × ${item.name} on ${label}`);
      byOrder.set(o.id, [...(byOrder.get(o.id) || []), item]);
    }

    const settings = await getSettings(tx);
    const targets = [];
    const remaining = [];
    for (const chosen of byOrder.values()) {
      const order = chosen[0].order;
      const everything = order.items.every((it) => (chosen.find((c) => c.id === it.id) ? wanted.get(it.id) === it.quantity : false));
      if (everything) { targets.push(order.id); continue; }
      if (await tx.paymentAttempt.count({ where: { orderId: order.id, status: 'initiated' } })) {
        throw new HttpError(409, `Bill #${String(order.billNo).padStart(5, '0')} has an online payment in progress`);
      }
      // New bill for the chosen items, keeping the original's table, status and time
      const split = await tx.order.create({
        data: {
          type: order.type, source: order.source, tableId: order.tableId, tableNumber: order.tableNumber,
          customerId: order.customerId, customerNote: order.customerNote, status: order.status,
          createdAt: order.createdAt, subtotal: 0, totalAmount: 0,
        },
      });
      for (const item of chosen) {
        const qty = wanted.get(item.id);
        if (qty === item.quantity) {
          await tx.orderItem.update({ where: { id: item.id }, data: { orderId: split.id } });
        } else {
          await tx.orderItem.update({ where: { id: item.id }, data: { quantity: item.quantity - qty, subtotal: round(item.price * (item.quantity - qty)) } });
          await tx.orderItem.create({
            data: {
              orderId: split.id, menuItemId: item.menuItemId, name: item.name, category: item.category,
              price: item.price, quantity: qty, subtotal: round(item.price * qty), portion: item.portion,
            },
          });
        }
      }
      targets.push(split.id);
      remaining.push(order);
    }

    // What is left on each original bill is re-totalled, keeping its discount (capped to the new subtotal)
    for (const order of remaining) {
      const left = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const subtotal = round(left.reduce((s, it) => s + it.subtotal, 0));
      await tx.order.update({ where: { id: order.id }, data: computeTotals(subtotal, order.discount, order.type, settings) });
    }

    const toPay = await tx.order.findMany({ where: { id: { in: targets } }, include: { items: true }, orderBy: { createdAt: 'asc' } });
    const subtotals = toPay.map((o) => round(o.items.reduce((s, it) => s + it.subtotal, 0)));
    const shares = splitDiscount(subtotals, discount);
    const paidAt = new Date();
    const paidOrders = [];
    for (const [i, o] of toPay.entries()) {
      paidOrders.push(await tx.order.update({
        where: { id: o.id },
        data: { ...computeTotals(subtotals[i], shares[i], o.type, settings), paymentStatus: 'paid', paymentMethod: method, paidAt },
        include: orderInclude,
      }));
    }
    const left = await tx.order.findMany({ where: { id: { in: remaining.map((o) => o.id) } }, include: orderInclude });
    return { paid: paidOrders, touched: left };
  });
  [...paid, ...touched].forEach((o) => events.publish('order.updated', o));
  res.json(paid);
}));

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
