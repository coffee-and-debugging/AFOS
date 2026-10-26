// Demo restaurant used for fresh installs (seed.js) and on request (demo.js).

const RESTAURANT = {
  id: 1,
  name: 'Yummy Foodland',
  tagline: 'Hot & delicious, made fresh',
  currency: 'Rs.',
  address: 'Bharatpur-10, Chitwan, Nepal',
  phone: '+977 9843670842',
  taxRate: 13,
  serviceChargeRate: 10,
  receiptFooter: 'Thank you for dining with us!',
};

const CATEGORIES = [
  { slug: 'burgers', name: 'Burgers', sortOrder: 1 },
  { slug: 'pizza', name: 'Pizza', sortOrder: 2 },
  { slug: 'momo', name: 'Momo', sortOrder: 3 },
  { slug: 'mains', name: 'Mains', sortOrder: 4 },
  { slug: 'sides', name: 'Sides', sortOrder: 5 },
  { slug: 'drinks', name: 'Drinks', sortOrder: 6 },
  { slug: 'desserts', name: 'Desserts', sortOrder: 7 },
];

const STOCK = [
  { name: 'Burger Bun', unit: 'pcs', quantity: 80, reorderLevel: 20, costPerUnit: 25 },
  { name: 'Chicken Fillet', unit: 'kg', quantity: 12, reorderLevel: 3, costPerUnit: 650 },
  { name: 'Chicken Patty', unit: 'pcs', quantity: 60, reorderLevel: 15, costPerUnit: 90 },
  { name: 'Cheddar Slice', unit: 'pcs', quantity: 100, reorderLevel: 25, costPerUnit: 18 },
  { name: 'Lettuce', unit: 'kg', quantity: 3, reorderLevel: 1, costPerUnit: 200 },
  { name: 'Pizza Dough', unit: 'pcs', quantity: 40, reorderLevel: 10, costPerUnit: 60 },
  { name: 'Mozzarella', unit: 'kg', quantity: 6, reorderLevel: 2, costPerUnit: 1100 },
  { name: 'Chicken Mince', unit: 'kg', quantity: 10, reorderLevel: 3, costPerUnit: 600 },
  { name: 'Momo Wrapper', unit: 'pcs', quantity: 400, reorderLevel: 100, costPerUnit: 2 },
  { name: 'Potatoes', unit: 'kg', quantity: 25, reorderLevel: 8, costPerUnit: 70 },
  { name: 'Cooking Oil', unit: 'L', quantity: 20, reorderLevel: 5, costPerUnit: 280 },
  { name: 'Coca-Cola Can', unit: 'pcs', quantity: 48, reorderLevel: 12, costPerUnit: 75 },
  { name: 'Lemons', unit: 'kg', quantity: 3, reorderLevel: 1, costPerUnit: 180 },
  { name: 'Milk', unit: 'L', quantity: 10, reorderLevel: 3, costPerUnit: 110 },
  { name: 'Chocolate', unit: 'kg', quantity: 2, reorderLevel: 0.5, costPerUnit: 1400 },
];

// recipe: [stock item name, quantity per unit sold]
const MENU = [
  { name: 'Crispy Chicken Burger', category: 'burgers', price: 450, description: 'Double crispy chicken, cheddar, lettuce and house sauce', recipe: [['Burger Bun', 1], ['Chicken Fillet', 0.15], ['Cheddar Slice', 2], ['Lettuce', 0.02]] },
  { name: 'Classic Cheeseburger', category: 'burgers', price: 420, description: 'Grilled chicken patty, melted cheddar, pickles', recipe: [['Burger Bun', 1], ['Chicken Patty', 1], ['Cheddar Slice', 1], ['Lettuce', 0.02]] },
  { name: 'Smoky BBQ Burger', category: 'burgers', price: 520, description: 'Two patties, smoky BBQ glaze, crispy onions', recipe: [['Burger Bun', 1], ['Chicken Patty', 2], ['Cheddar Slice', 1]] },
  { name: 'Margherita Pizza', category: 'pizza', price: 650, description: 'Tomato, mozzarella and fresh basil', recipe: [['Pizza Dough', 1], ['Mozzarella', 0.15]] },
  { name: 'Chicken Pepperoni Pizza', category: 'pizza', price: 850, description: 'Spicy chicken pepperoni, double cheese', recipe: [['Pizza Dough', 1], ['Mozzarella', 0.15], ['Chicken Mince', 0.1]] },
  { name: 'Veggie Supreme Pizza', category: 'pizza', price: 720, description: 'Peppers, olives, onions, mushrooms', recipe: [['Pizza Dough', 1], ['Mozzarella', 0.12]] },
  { name: 'Chicken Steam Momo', category: 'momo', price: 220, description: '10 pieces with tomato achar', recipe: [['Momo Wrapper', 10], ['Chicken Mince', 0.15]] },
  { name: 'Chicken Jhol Momo', category: 'momo', price: 260, description: '10 pieces in spicy sesame broth', recipe: [['Momo Wrapper', 10], ['Chicken Mince', 0.15]] },
  { name: 'Veg Fried Momo', category: 'momo', price: 200, description: '10 crispy fried vegetable momo', recipe: [['Momo Wrapper', 10], ['Cooking Oil', 0.05]] },
  { name: 'Chicken Thakali Set', category: 'mains', price: 550, description: 'Rice, dal, chicken curry, greens and achar', recipe: [['Chicken Fillet', 0.2]] },
  { name: 'Butter Chicken & Naan', category: 'mains', price: 600, description: 'Creamy tomato butter chicken with two naans', recipe: [['Chicken Fillet', 0.2], ['Milk', 0.05]] },
  { name: 'French Fries', category: 'sides', price: 180, description: 'Golden, salted, with ketchup', recipe: [['Potatoes', 0.25], ['Cooking Oil', 0.05]] },
  { name: 'Hot Chicken Wings', category: 'sides', price: 380, description: '6 wings tossed in hot sauce', recipe: [['Chicken Fillet', 0.3], ['Cooking Oil', 0.05]] },
  { name: 'Coca-Cola', category: 'drinks', price: 120, description: '330 ml can', recipe: [['Coca-Cola Can', 1]] },
  { name: 'Fresh Lemon Soda', category: 'drinks', price: 150, description: 'Sweet, salted or mixed', recipe: [['Lemons', 0.05]] },
  { name: 'Masala Tea', category: 'drinks', price: 80, description: 'Spiced milk tea', recipe: [['Milk', 0.15]] },
  { name: 'Chocolate Brownie', category: 'desserts', price: 250, description: 'Warm brownie with chocolate sauce', recipe: [['Chocolate', 0.05]] },
];

const SUPPLIERS = [
  { name: 'Himalayan Fresh Meats', phone: '9801000001', address: 'Kalimati, Kathmandu' },
  { name: 'Valley Bakery Supplies', phone: '9801000002', address: 'Lalitpur' },
  { name: 'Kathmandu Beverages', phone: '9801000003', address: 'Balaju Industrial Area' },
];

// The original tea-shop sample menu; demo.js removes these only if untouched and never ordered.
const LEGACY_SAMPLE = [
  ['Green Tea', 150], ['Oolong Tea', 200], ['Matcha Latte', 280], ['Earl Grey', 150], ['Chamomile', 150],
  ['Egg Tart', 120], ['Scone', 180], ['Tea Sandwich', 250], ['Almond Cake', 220],
];

/** Adds any missing demo categories, stock, menu items (with recipes) and suppliers. Matches by name. */
async function addDemoData(prisma) {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }

  const stockIds = {};
  for (const s of STOCK) {
    const existing = await prisma.stockItem.findUnique({ where: { name: s.name } });
    const item = existing || await prisma.stockItem.create({ data: s });
    if (!existing) {
      await prisma.stockMovement.create({ data: { stockItemId: item.id, change: s.quantity, reason: 'adjustment', note: 'Opening stock' } });
    }
    stockIds[s.name] = item.id;
  }

  let added = 0;
  for (const { recipe, ...m } of MENU) {
    if (await prisma.menuItem.findFirst({ where: { name: m.name } })) continue;
    const item = await prisma.menuItem.create({ data: m });
    await prisma.recipeItem.createMany({
      data: recipe.map(([name, quantity]) => ({ menuItemId: item.id, stockItemId: stockIds[name], quantity })),
    });
    added++;
  }

  for (const s of SUPPLIERS) {
    if (!(await prisma.supplier.findFirst({ where: { name: s.name } }))) await prisma.supplier.create({ data: s });
  }
  return added;
}

module.exports = { RESTAURANT, CATEGORIES, MENU, STOCK, LEGACY_SAMPLE, addDemoData };
