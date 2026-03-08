const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({ orderBy: { category: 'asc' } });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

router.post('/', requireAuth(['admin']), async (req, res) => {
  const { name, description, price, category } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'name, price and category are required' });
  }
  try {
    const item = await prisma.menuItem.create({
      data: { name, description: description || '', price: parseFloat(price), category, available: true },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.put('/:id', requireAuth(['admin']), async (req, res) => {
  const { name, description, price, category, available } = req.body;
  try {
    const item = await prisma.menuItem.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(category !== undefined && { category }),
        ...(available !== undefined && { available: Boolean(available) }),
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
