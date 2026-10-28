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

// New display order: body is every category slug, first to last
router.put('/', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const slugs = Array.isArray(req.body) ? req.body.map(String) : [];
  const existing = await prisma.category.findMany({ select: { slug: true } });
  if (slugs.length !== existing.length || !existing.every((c) => slugs.includes(c.slug))) {
    throw new HttpError(400, 'Send every category exactly once');
  }
  await prisma.$transaction(slugs.map((slug, i) => prisma.category.update({ where: { slug }, data: { sortOrder: i + 1 } })));
  res.json({ success: true });
}));

// Rename. The slug (used by menu items and links) stays the same, so nothing else has to change.
router.put('/:slug', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, 'Category name is required');
  const clash = await prisma.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, slug: { not: req.params.slug } } });
  if (clash) throw new HttpError(409, `A category called "${clash.name}" already exists`);
  const existing = await prisma.category.findUnique({ where: { slug: req.params.slug } });
  if (!existing) throw new HttpError(404, 'Category not found');
  res.json(await prisma.category.update({ where: { slug: existing.slug }, data: { name } }));
}));

router.delete('/:slug', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const inUse = await prisma.menuItem.count({ where: { category: req.params.slug } });
  if (inUse) throw new HttpError(409, 'Move or delete the items in this category first');
  await prisma.category.delete({ where: { slug: req.params.slug } });
  res.json({ success: true });
}));

module.exports = router;
