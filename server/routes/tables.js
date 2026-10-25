const express = require('express');
const QRCode = require('qrcode');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { newTableId } = require('../lib/ids');
const { normalizeBaseUrl } = require('./restaurant');

const router = express.Router();

// Tables with live occupancy: unpaid, non-cancelled orders count as an open bill.
router.get('/', requireAuth(ROLES.FRONT), asyncHandler(async (req, res) => {
  const [tables, open] = await Promise.all([
    prisma.table.findMany({ orderBy: { number: 'asc' } }),
    prisma.order.groupBy({
      by: ['tableId'],
      where: { tableId: { not: null }, paymentStatus: { not: 'paid' }, status: { not: 'cancelled' } },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _min: { createdAt: true },
    }),
  ]);
  res.json(tables.map((t) => {
    const o = open.find((x) => x.tableId === t.id);
    return {
      ...t,
      openOrders: o?._count._all ?? 0,
      openAmount: o?._sum.totalAmount ?? 0,
      occupiedSince: o?._min.createdAt ?? null,
    };
  }));
}));

router.post('/', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const num = Number.parseInt(req.body?.number, 10);
  if (!Number.isInteger(num) || num <= 0) throw new HttpError(400, 'Table number must be a positive whole number');
  if (await prisma.table.findUnique({ where: { number: num } })) throw new HttpError(409, `Table ${num} already exists`);
  const table = await prisma.table.create({ data: { id: newTableId(), number: num } });
  res.status(201).json({ ...table, openOrders: 0, openAmount: 0, occupiedSince: null });
}));

router.delete('/:id', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const orders = await prisma.order.count({ where: { tableId: req.params.id } });
  if (orders) throw new HttpError(409, 'This table has order history and cannot be removed');
  await prisma.table.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// Public: the guest menu shows which table it's for. Only the number is revealed.
router.get('/:id/public', asyncHandler(async (req, res) => {
  const table = await prisma.table.findUnique({ where: { id: req.params.id }, select: { id: true, number: true } });
  if (!table) throw new HttpError(404, 'This table QR code is no longer valid. Please ask our staff.');
  res.json(table);
}));

/**
 * QR code for a table. Address used, in order: ?baseUrl= (the admin screen sends the PC's
 * network address), the "Guest ordering address" setting, then the address of this request.
 */
router.get('/:id/qr', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const table = await prisma.table.findUnique({ where: { id: req.params.id } });
  if (!table) throw new HttpError(404, 'Table not found');

  const settings = await prisma.restaurant.findUnique({ where: { id: 1 }, select: { qrBaseUrl: true } });
  const baseUrl = normalizeBaseUrl(req.query.baseUrl)
    || settings?.qrBaseUrl
    || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/table/${table.id}/`;
  const qrCode = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qrCode, url, tableNumber: table.number });
}));

module.exports = router;
