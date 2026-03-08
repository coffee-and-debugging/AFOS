const express = require('express');
const QRCode = require('qrcode');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth(['admin']), async (req, res) => {
  try {
    const tables = await prisma.table.findMany({ orderBy: { number: 'asc' } });
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

router.post('/', requireAuth(['admin']), async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'Table number is required' });
  const num = parseInt(number);
  try {
    const table = await prisma.table.create({
      data: { id: `table-${num}`, number: num },
    });
    res.status(201).json(table);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Table number already exists' });
    res.status(500).json({ error: 'Failed to create table' });
  }
});

router.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    await prisma.table.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Table not found' });
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

router.get('/:id/qr', requireAuth(['admin']), async (req, res) => {
  try {
    const table = await prisma.table.findUnique({ where: { id: req.params.id } });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const baseUrl = req.query.baseUrl || 'http://localhost:5173';
    const url = `${baseUrl}/table/${table.id}`;
    const qrCode = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    res.json({ qrCode, url, tableNumber: table.number });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

module.exports = router;
