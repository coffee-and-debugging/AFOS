const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Multer setup for image uploads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const rawName = (req.body && req.body.itemName) ? req.body.itemName : 'item';
    const safeName = rawName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    cb(null, `menu-${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Upload image → returns { imageUrl }
router.post('/upload', requireAuth(['admin']), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

router.get('/', async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({ orderBy: { category: 'asc' } });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

router.post('/', requireAuth(['admin']), async (req, res) => {
  const { name, description, price, category, imageUrl } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'name, price and category are required' });
  }
  try {
    const item = await prisma.menuItem.create({
      data: { name, description: description || '', price: parseFloat(price), category, available: true, imageUrl: imageUrl || null },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.put('/:id', requireAuth(['admin']), async (req, res) => {
  const { name, description, price, category, available, imageUrl } = req.body;
  try {
    const item = await prisma.menuItem.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(category !== undefined && { category }),
        ...(available !== undefined && { available: Boolean(available) }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      },
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Item not found' });
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    await prisma.menuItem.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Item not found' });
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
