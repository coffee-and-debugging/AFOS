const express = require('express');
const store = require('../store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all orders — admin or chef only
router.get('/', requireAuth(['admin', 'chef']), (req, res) => {
  const { tableId, status } = req.query;
  let orders = [...store.orders];
  if (tableId) orders = orders.filter((o) => o.tableId === tableId);
  if (status) orders = orders.filter((o) => o.status === status);
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Get single order — public (customers track their own order by ID)
router.get('/:id', (req, res) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Create order — public (customer at a table)
router.post('/', (req, res) => {
  const { tableId, items, customerNote } = req.body;
  if (!tableId || !items || !items.length) {
    return res.status(400).json({ error: 'tableId and items are required' });
  }
  const table = store.tables.find((t) => t.id === tableId);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  let orderItems;
  try {
    orderItems = items.map((item) => {
      const menuItem = store.menuItems.find((m) => m.id === item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      if (!menuItem.available) throw new Error(`${menuItem.name} is not available`);
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        subtotal: menuItem.price * item.quantity,
      };
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const totalAmount = orderItems.reduce((s, i) => s + i.subtotal, 0);

  const order = {
    id: crypto.randomUUID(),
    tableId,
    tableNumber: table.number,
    items: orderItems,
    customerNote: customerNote || '',
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    totalAmount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.orders.push(order);
  res.status(201).json(order);
});

// Update order status — admin or chef
router.put('/:id/status', requireAuth(['admin', 'chef']), (req, res) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status } = req.body;
  const valid = ['pending', 'cooking', 'serving', 'completed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  res.json(order);
});

// Process payment — public (customer pays: esewa / khalti / counter)
router.post('/:id/payment', (req, res) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.paymentStatus === 'paid') {
    return res.status(400).json({ error: 'Order already paid' });
  }

  const { method } = req.body;
  if (!['esewa', 'khalti', 'counter'].includes(method)) {
    return res.status(400).json({ error: 'method must be esewa, khalti, or counter' });
  }

  order.paymentMethod = method;
  order.paymentStatus = method === 'counter' ? 'pending_counter' : 'paid';
  order.updatedAt = new Date().toISOString();
  res.json(order);
});

// Confirm counter payment — admin only (cash received at counter)
router.post('/:id/confirm-payment', requireAuth(['admin']), (req, res) => {
  const order = store.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.paymentStatus === 'paid') {
    return res.status(400).json({ error: 'Order is already paid' });
  }
  order.paymentStatus = 'paid';
  order.paymentMethod = order.paymentMethod || 'counter';
  order.updatedAt = new Date().toISOString();
  res.json(order);
});

module.exports = router;
