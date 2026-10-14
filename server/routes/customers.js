const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireFeature, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { orderInclude } = require('../lib/orders');

const router = express.Router();
router.use(requireAuth(ROLES.FRONT), requireFeature('customers'));

function parseCustomer(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Customer name is required');
  const phone = String(body.phone || '').replace(/[^\d+]/g, '') || null;
  return {
    name,
    phone,
    email: String(body.email || '').trim(),
    notes: String(body.notes || '').trim().slice(0, 1000),
  };
}

// List with lifetime stats. ?q= searches name and phone.
router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : undefined,
    orderBy: { name: 'asc' },
    take: 500,
  });
  const stats = await prisma.order.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customers.map((c) => c.id) }, status: { not: 'cancelled' } },
    _count: { _all: true },
    _sum: { totalAmount: true },
    _max: { createdAt: true },
  });
  res.json(customers.map((c) => {
    const s = stats.find((x) => x.customerId === c.id);
    return { ...c, visits: s?._count._all ?? 0, totalSpent: s?._sum.totalAmount ?? 0, lastVisit: s?._max.createdAt ?? null };
  }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) throw new HttpError(404, 'Customer not found');
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ ...customer, orders });
}));

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.customer.create({ data: parseCustomer(req.body) }));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  res.json(await prisma.customer.update({ where: { id: req.params.id }, data: parseCustomer(req.body) }));
}));

// Orders keep their history; the link is cleared (onDelete: SetNull).
router.delete('/:id', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

module.exports = router;
