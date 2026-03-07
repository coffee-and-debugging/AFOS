const express = require('express');
const QRCode = require('qrcode');
const store = require('../store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth(['admin']), (req, res) => {
  res.json(store.tables);
});

router.post('/', requireAuth(['admin']), (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'Table number is required' });
  if (store.tables.find((t) => t.number === parseInt(number))) {
    return res.status(400).json({ error: 'Table number already exists' });
  }
  const table = { id: `table-${parseInt(number)}`, number: parseInt(number) };
  store.tables.push(table);
  res.status(201).json(table);
});

router.delete('/:id', requireAuth(['admin']), (req, res) => {
  const idx = store.tables.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Table not found' });
  store.tables.splice(idx, 1);
  res.json({ success: true });
});

router.get('/:id/qr', requireAuth(['admin']), async (req, res) => {
  const table = store.tables.find((t) => t.id === req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const baseUrl = req.query.baseUrl || 'http://localhost:5173';
  const url = `${baseUrl}/table/${table.id}`;
  try {
    const qrCode = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    res.json({ qrCode, url, tableNumber: table.number });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

module.exports = router;
