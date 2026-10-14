const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');

const router = express.Router();
router.use(requireAuth(ROLES.ADMIN));

function parseSupplier(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'Supplier name is required');
  return {
    name,
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim(),
    address: String(body.address || '').trim(),
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const [suppliers, totals] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.purchase.groupBy({ by: ['supplierId'], _count: { _all: true }, _sum: { totalAmount: true } }),
  ]);
  res.json(suppliers.map((s) => {
    const t = totals.find((x) => x.supplierId === s.id);
    return { ...s, purchases: t?._count._all ?? 0, totalPurchased: t?._sum.totalAmount ?? 0 };
  }));
}));

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.supplier.create({ data: parseSupplier(req.body) }));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  res.json(await prisma.supplier.update({ where: { id: req.params.id }, data: parseSupplier(req.body) }));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.supplier.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

module.exports = router;
