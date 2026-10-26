const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../prisma');
const { uploadsDir } = require('../lib/config');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const rawName = req.body?.itemName || 'item';
    const safeName = rawName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
    cb(null, `menu-${safeName}-${Date.now().toString(36)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new HttpError(400, 'Only image files are allowed'));
  },
});

function parsePrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Price must be a positive number');
  return price;
}

/** Optional half-plate price: empty/null turns half plates off for the item. */
function parseHalfPrice(value) {
  if (value === null || value === '' || value === undefined) return null;
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, 'Half plate price must be a positive number, or leave it empty');
  return price;
}

function parseId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid menu item id');
  return id;
}

router.post('/upload', requireAuth(['admin']), upload.single('image'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

router.get('/', asyncHandler(async (req, res) => {
  res.json(await prisma.menuItem.findMany({ orderBy: [{ categoryRef: { sortOrder: 'asc' } }, { name: 'asc' }] }));
}));

router.post('/', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const { name, description, price, halfPrice, category, imageUrl } = req.body || {};
  if (!name || price === undefined || !category) {
    throw new HttpError(400, 'Name, price and category are required');
  }
  const item = await prisma.menuItem.create({
    data: {
      name: String(name).trim(),
      description: description || '',
      price: parsePrice(price),
      halfPrice: parseHalfPrice(halfPrice),
      category,
      available: true,
      imageUrl: imageUrl || null,
    },
  });
  res.status(201).json(item);
}));

router.put('/:id', requireAuth(['admin']), asyncHandler(async (req, res) => {
  const { name, description, price, halfPrice, category, available, imageUrl } = req.body || {};
  const item = await prisma.menuItem.update({
    where: { id: parseId(req.params.id) },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: parsePrice(price) }),
      ...(halfPrice !== undefined && { halfPrice: parseHalfPrice(halfPrice) }),
      ...(category !== undefined && { category }),
      ...(available !== undefined && { available: Boolean(available) }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
    },
  });
  res.json(item);
}));

router.delete('/:id', requireAuth(['admin']), asyncHandler(async (req, res) => {
  await prisma.menuItem.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
}));

// Ingredients used per unit sold; drives automatic stock deduction.
router.get('/:id/recipe', requireAuth(ROLES.STAFF), asyncHandler(async (req, res) => {
  res.json(await prisma.recipeItem.findMany({
    where: { menuItemId: parseId(req.params.id) },
    include: { stockItem: { select: { name: true, unit: true } } },
  }));
}));

router.put('/:id/recipe', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const menuItemId = parseId(req.params.id);
  const rows = Array.isArray(req.body) ? req.body : [];
  const data = rows.map((r) => {
    const stockItemId = Number(r.stockItemId);
    const quantity = Number(r.quantity);
    if (!Number.isInteger(stockItemId)) throw new HttpError(400, 'Choose a stock item for every ingredient');
    if (!(quantity > 0)) throw new HttpError(400, 'Ingredient quantities must be greater than zero');
    return { menuItemId, stockItemId, quantity };
  });
  if (new Set(data.map((d) => d.stockItemId)).size !== data.length) throw new HttpError(400, 'Each ingredient can appear only once');

  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { menuItemId } }),
    prisma.recipeItem.createMany({ data }),
  ]);
  res.json(await prisma.recipeItem.findMany({
    where: { menuItemId },
    include: { stockItem: { select: { name: true, unit: true } } },
  }));
}));

module.exports = router;
