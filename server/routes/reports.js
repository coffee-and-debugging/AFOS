const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { round } = require('../lib/orders');

const router = express.Router();
const DAY = 24 * 60 * 60 * 1000;

function sumBy(list, key, value) {
  const map = new Map();
  for (const row of list) {
    const k = key(row);
    map.set(k, (map.get(k) || 0) + value(row));
  }
  return map;
}

/**
 * Sales, purchases, cost and stock figures for a period.
 * Query: from, to (ISO instants), tz = browser's getTimezoneOffset() so days/hours group in local time.
 */
router.get('/summary', requireAuth(ROLES.FRONT), asyncHandler(async (req, res) => {
  const from = new Date(String(req.query.from || ''));
  const to = new Date(String(req.query.to || ''));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw new HttpError(400, 'Provide a valid from/to range');
  }
  if (to - from > 400 * DAY) throw new HttpError(400, 'Reports cover at most 400 days at a time');
  const tzMs = (Number(req.query.tz) || 0) * 60 * 1000;
  const localDay = (d) => new Date(d.getTime() - tzMs).toISOString().slice(0, 10);
  const localHour = (d) => new Date(d.getTime() - tzMs).getUTCHours();

  const range = { gte: from, lt: to };
  const [orders, categories, purchases, saleMovements, stock] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: range }, include: { items: true } }),
    prisma.category.findMany(),
    prisma.purchase.findMany({ where: { date: range }, select: { totalAmount: true, paymentStatus: true } }),
    prisma.stockMovement.findMany({
      where: { createdAt: range, reason: { in: ['sale', 'cancel'] } },
      include: { stockItem: { select: { costPerUnit: true } } },
    }),
    prisma.stockItem.findMany(),
  ]);

  const valid = orders.filter((o) => o.status !== 'cancelled');
  const paid = valid.filter((o) => o.paymentStatus === 'paid');
  const total = (list, k) => round(list.reduce((s, o) => s + o[k], 0));

  const netSales = total(valid, 'totalAmount');
  const tax = total(valid, 'tax');
  const costOfGoods = round(saleMovements.reduce((s, m) => s + -m.change * m.stockItem.costPerUnit, 0));

  // Every day in the range appears, even with zero sales, so charts have no gaps
  const salesByDay = sumBy(valid, (o) => localDay(o.createdAt), (o) => o.totalAmount);
  const ordersByDay = sumBy(valid, (o) => localDay(o.createdAt), () => 1);
  const days = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY) {
    const day = localDay(new Date(t));
    if (days.at(-1)?.date !== day) days.push({ date: day, sales: round(salesByDay.get(day) || 0), orders: ordersByDay.get(day) || 0 });
  }

  const ordersByHour = sumBy(valid, (o) => localHour(o.createdAt), () => 1);
  const lines = valid.flatMap((o) => o.items);
  const qtyByItem = sumBy(lines, (l) => l.name, (l) => l.quantity);
  const revenueByItem = sumBy(lines, (l) => l.name, (l) => l.subtotal);
  const categoryName = (slug) => categories.find((c) => c.slug === slug)?.name || slug || 'Uncategorised';

  res.json({
    totals: {
      orders: valid.length,
      cancelled: orders.length - valid.length,
      grossSales: total(valid, 'subtotal'),
      discounts: total(valid, 'discount'),
      serviceCharge: total(valid, 'serviceCharge'),
      tax,
      netSales,
      collected: total(paid, 'totalAmount'),
      outstanding: round(netSales - total(paid, 'totalAmount')),
      averageTicket: valid.length ? round(netSales / valid.length) : 0,
      itemsSold: lines.reduce((s, l) => s + l.quantity, 0),
      purchases: round(purchases.reduce((s, p) => s + p.totalAmount, 0)),
      purchasesUnpaid: round(purchases.filter((p) => p.paymentStatus === 'unpaid').reduce((s, p) => s + p.totalAmount, 0)),
      costOfGoods,
      grossProfit: round(netSales - tax - costOfGoods),
    },
    byDay: days,
    byHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: ordersByHour.get(h) || 0 })),
    byPayment: [...sumBy(paid, (o) => o.paymentMethod || 'other', (o) => o.totalAmount)]
      .map(([method, amount]) => ({ method, amount: round(amount) })),
    byType: [...sumBy(valid, (o) => o.type, (o) => o.totalAmount)].map(([type, amount]) => ({ type, amount: round(amount) })),
    byCategory: [...sumBy(lines, (l) => categoryName(l.category), (l) => l.subtotal)]
      .map(([name, amount]) => ({ name, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount),
    topItems: [...qtyByItem]
      .map(([name, quantity]) => ({ name, quantity, revenue: round(revenueByItem.get(name)) }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10),
    stock: {
      value: round(stock.reduce((s, i) => s + Math.max(i.quantity, 0) * i.costPerUnit, 0)),
      lowStock: stock.filter((i) => i.quantity <= i.reorderLevel)
        .map((i) => ({ id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, reorderLevel: i.reorderLevel })),
    },
  });
}));

module.exports = router;
