const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');

const router = express.Router();

const slugify = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

router.get('/', asyncHandler(async (req, res) => {
  res.json(await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }));
}));

router.post('/', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const slug = slugify(name);
  if (!slug) throw new HttpError(400, 'Category name is required');

  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.category.create({
    data: { name, slug, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json(category);
}));

router.delete('/:slug', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const inUse = await prisma.menuItem.count({ where: { category: req.params.slug } });
  if (inUse) throw new HttpError(409, 'Move or delete the items in this category first');
  await prisma.category.delete({ where: { slug: req.params.slug } });
  res.json({ success: true });
}));

module.exports = router;
