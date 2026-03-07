const store = {
  users: [
    { id: '1', username: 'admin', password: 'admin123', role: 'admin', name: 'Admin' },
    { id: '2', username: 'chef', password: 'chef123', role: 'chef', name: 'Chef' },
  ],
  menuItems: [
    { id: '1', name: 'Green Tea', description: 'Refreshing Japanese green tea', price: 150, category: 'tea', available: true },
    { id: '2', name: 'Oolong Tea', description: 'Premium semi-oxidized oolong', price: 200, category: 'tea', available: true },
    { id: '3', name: 'Matcha Latte', description: 'Smooth matcha with steamed milk', price: 280, category: 'tea', available: true },
    { id: '4', name: 'Earl Grey', description: 'Classic bergamot black tea', price: 150, category: 'tea', available: true },
    { id: '5', name: 'Chamomile', description: 'Soothing herbal chamomile', price: 150, category: 'tea', available: true },
    { id: '6', name: 'Egg Tart', description: 'Freshly baked silky egg tart', price: 120, category: 'food', available: true },
    { id: '7', name: 'Scone', description: 'Buttery scone with jam & cream', price: 180, category: 'food', available: true },
    { id: '8', name: 'Tea Sandwich', description: 'Assorted finger sandwiches', price: 250, category: 'food', available: true },
    { id: '9', name: 'Almond Cake', description: 'Light almond sponge cake slice', price: 220, category: 'food', available: true },
  ],
  tables: [
    { id: 'table-1', number: 1 },
    { id: 'table-2', number: 2 },
    { id: 'table-3', number: 3 },
    { id: 'table-4', number: 4 },
  ],
  orders: [],
};

module.exports = store;
