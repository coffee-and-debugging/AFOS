const express = require('express');
const store = require('../store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(store.menuItems);
});

router.post('/', requireAuth(['admin']), (req, res) => {
  const { name, description, price, category } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'name, price and category are required' });
  }
  const item = {
    id: crypto.randomUUID(),
    name,
    description: description || '',
    price: parseFloat(price),
    category,
    available: true,
  };
  store.menuItems.push(item);
  res.status(201).json(item);
});

router.put('/:id', requireAuth(['admin']), (req, res) => {
  const idx = store.menuItems.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  store.menuItems[idx] = { ...store.menuItems[idx], ...req.body, id: req.params.id };
  res.json(store.menuItems[idx]);
});

router.delete('/:id', requireAuth(['admin']), (req, res) => {
  const idx = store.menuItems.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  store.menuItems.splice(idx, 1);
  res.json({ success: true });
});

module.exports = router;
