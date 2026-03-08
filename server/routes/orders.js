const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Serialize a Prisma order (with items) to the API shape the frontend expects
function serializeOrder(order) {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

// Get all orders — admin or chef only
router.get('/', requireAuth(['admin', 'chef']), async (req, res) => {
  const { tableId, status } = req.query;
  try {
    const orders = await prisma.order.findMany({
      where: {
        ...(tableId && { tableId }),
        ...(status && { status }),
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order — public (customers track by ID)
router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create order — public (customer at a table)
router.post('/', async (req, res) => {
  const { tableId, items, customerNote } = req.body;
  if (!tableId || !items || !items.length) {
    return res.status(400).json({ error: 'tableId and items are required' });
  }

  try {
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const menuItemIds = items.map((i) => parseInt(i.menuItemId));
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } });

    const orderItemsData = [];
    for (const item of items) {
      const menuItem = menuItems.find((m) => m.id === parseInt(item.menuItemId));
      if (!menuItem) return res.status(400).json({ error: `Menu item ${item.menuItemId} not found` });
      if (!menuItem.available) return res.status(400).json({ error: `${menuItem.name} is not available` });
      orderItemsData.push({
        menuItemId: String(menuItem.id),
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        subtotal: menuItem.price * item.quantity,
      });
    }

    const totalAmount = orderItemsData.reduce((s, i) => s + i.subtotal, 0);

    const order = await prisma.order.create({
      data: {
        tableId,
        tableNumber: table.number,
        customerNote: customerNote || '',
        totalAmount,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });
    res.status(201).json(serializeOrder(order));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status — admin or chef
router.put('/:id/status', requireAuth(['admin', 'chef']), async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'cooking', 'serving', 'completed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
  }
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { items: true },
    });
    res.json(serializeOrder(order));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Order not found' });
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Process payment — public (customer pays: esewa / khalti / counter)
router.post('/:id/payment', async (req, res) => {
  const { method } = req.body;
  if (!['esewa', 'khalti', 'counter'].includes(method)) {
    return res.status(400).json({ error: 'method must be esewa, khalti, or counter' });
  }
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (existing.paymentStatus === 'paid') return res.status(400).json({ error: 'Order already paid' });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        paymentMethod: method,
        paymentStatus: method === 'counter' ? 'pending_counter' : 'paid',
      },
      include: { items: true },
    });
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Confirm counter payment — admin only
router.post('/:id/confirm-payment', requireAuth(['admin']), async (req, res) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (existing.paymentStatus === 'paid') return res.status(400).json({ error: 'Order is already paid' });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        paymentStatus: 'paid',
        paymentMethod: existing.paymentMethod || 'counter',
      },
      include: { items: true },
    });
    res.json(serializeOrder(order));
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

module.exports = router;
