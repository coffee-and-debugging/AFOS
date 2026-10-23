// Staff categories (departments). Mounted under /api/staff/categories behind the managers-only check.
const express = require('express');
const prisma = require('../prisma');
const { HttpError, asyncHandler } = require('../lib/http');

const router = express.Router();

const COLORS = ['red', 'orange', 'amber', 'green', 'blue', 'purple', 'gray'];

function parseCategory(body = {}, existing = null) {
  const name = String(body.name ?? existing?.name ?? '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, 'Category name is required');
  const color = String(body.color ?? existing?.color ?? 'gray');
  if (!COLORS.includes(color)) throw new HttpError(400, `Colour must be one of: ${COLORS.join(', ')}`);
  return {
    name,
    color,
    description: String(body.description ?? existing?.description ?? '').trim().slice(0, 120),
  };
}

/** Case-insensitive duplicate check, so "Kitchen" and "kitchen" can't both exist. */
async function assertUniqueName(name, exceptId) {
  const clash = await prisma.staffCategory.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
  });
  if (clash) throw new HttpError(409, `A category called "${clash.name}" already exists`);
}

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid category id');
  return id;
};

// With headcount (active staff) and monthly salary bill per category
router.get('/', asyncHandler(async (req, res) => {
  const [categories, totals] = await Promise.all([
    prisma.staffCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.user.groupBy({ by: ['categoryId'], where: { active: true }, _count: true, _sum: { baseSalary: true } }),
  ]);
  res.json(categories.map((c) => {
    const t = totals.find((x) => x.categoryId === c.id);
    return { ...c, activeStaff: t?._count || 0, salaryBill: t?._sum.baseSalary || 0 };
  }));
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = parseCategory(req.body);
  await assertUniqueName(data.name);
  const last = await prisma.staffCategory.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.staffCategory.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  res.status(201).json({ ...created, activeStaff: 0, salaryBill: 0 });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await prisma.staffCategory.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Category not found');
  const data = parseCategory(req.body, existing);
  await assertUniqueName(data.name, id);
  res.json(await prisma.staffCategory.update({ where: { id }, data }));
}));

// Save a new display order: body = [id, id, …]
router.put('/', asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body) ? req.body.map(parseId) : [];
  await prisma.$transaction(ids.map((id, i) => prisma.staffCategory.update({ where: { id }, data: { sortOrder: i + 1 } })));
  res.json({ success: true });
}));

/**
 * Removes a category. If people are still in it, `?moveTo=<id>` moves them first,
 * or `?moveTo=none` leaves them uncategorised; without it the request is refused.
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const members = await prisma.user.count({ where: { categoryId: id } });
  const { moveTo } = req.query;
  if (members && moveTo === undefined) {
    throw new HttpError(409, `${members} staff member${members === 1 ? ' is' : 's are'} in this category. Choose where to move them.`);
  }
  const target = moveTo && moveTo !== 'none' ? parseId(moveTo) : null;
  if (target === id) throw new HttpError(400, 'Choose a different category to move staff into');

  await prisma.$transaction(async (tx) => {
    if (target && !(await tx.staffCategory.findUnique({ where: { id: target } }))) throw new HttpError(404, 'Target category not found');
    await tx.user.updateMany({ where: { categoryId: id }, data: { categoryId: target } });
    await tx.staffCategory.delete({ where: { id } });
  });
  res.json({ success: true, moved: members });
}));

module.exports = router;
module.exports.COLORS = COLORS;
