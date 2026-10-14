// Shared order logic used by guest (QR) ordering and the POS.
const { HttpError } = require('./http');

const MAX_QTY_PER_ITEM = 50;
const round = (n) => Math.round(n * 100) / 100;

const orderInclude = {
  items: true,
  customer: { select: { id: true, name: true, phone: true } },
};

async function getSettings(db) {
  const settings = await db.restaurant.findUnique({ where: { id: 1 } });
  return settings || { taxRate: 0, serviceChargeRate: 0 };
}

/** Discount → service charge (dine-in only) → tax on (subtotal − discount + service). */
function computeTotals(subtotal, discount, type, settings) {
  const disc = Math.min(Math.max(round(Number(discount) || 0), 0), subtotal);
  const base = subtotal - disc;
  const serviceCharge = type === 'dine_in' ? round((base * settings.serviceChargeRate) / 100) : 0;
  const tax = round(((base + serviceCharge) * settings.taxRate) / 100);
  return { subtotal: round(subtotal), discount: disc, serviceCharge, tax, totalAmount: round(base + serviceCharge + tax) };
}

/** Adjusts stock for every ingredient used by the given order lines. sign = -1 consumes, +1 restores. */
async function applyRecipeStock(tx, lines, sign, reason, refId) {
  const ids = lines.map((l) => Number(l.menuItemId));
  const recipes = await tx.recipeItem.findMany({ where: { menuItemId: { in: ids } } });
  if (!recipes.length) return;

  const totals = new Map();
  for (const line of lines) {
    for (const r of recipes.filter((x) => x.menuItemId === Number(line.menuItemId))) {
      totals.set(r.stockItemId, (totals.get(r.stockItemId) || 0) + r.quantity * line.quantity);
    }
  }
  for (const [stockItemId, qty] of totals) {
    const change = round(sign * qty * 1000) / 1000;
    await tx.stockItem.update({ where: { id: stockItemId }, data: { quantity: { increment: change } } });
    await tx.stockMovement.create({ data: { stockItemId, change, reason, refId } });
  }
}

/** Validates the requested lines against the live menu and creates the order + stock movements. */
async function createOrder(tx, { items, type = 'dine_in', source, tableId, customerId, customerNote, discount }) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Add at least one item to the order');
  if (!['dine_in', 'takeaway'].includes(type)) throw new HttpError(400, 'Order type must be dine-in or takeaway');

  let table = null;
  if (type === 'dine_in') {
    if (!tableId) throw new HttpError(400, 'Choose a table for dine-in orders');
    table = await tx.table.findUnique({ where: { id: String(tableId) } });
    if (!table) throw new HttpError(404, 'Table not found');
  }
  if (customerId) {
    const exists = await tx.customer.findUnique({ where: { id: String(customerId) } });
    if (!exists) throw new HttpError(404, 'Customer not found');
  }

  const requested = items.map((i) => ({ id: Number.parseInt(i.menuItemId, 10), quantity: Number(i.quantity) }));
  for (const { id, quantity } of requested) {
    if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid menu item');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
      throw new HttpError(400, `Quantity must be between 1 and ${MAX_QTY_PER_ITEM}`);
    }
  }

  const menuItems = await tx.menuItem.findMany({ where: { id: { in: requested.map((r) => r.id) } } });
  const lines = requested.map(({ id, quantity }) => {
    const m = menuItems.find((x) => x.id === id);
    if (!m) throw new HttpError(400, 'One of the items is no longer on the menu');
    if (!m.available) throw new HttpError(400, `${m.name} is not available right now`);
    return { menuItemId: String(m.id), name: m.name, category: m.category, price: m.price, quantity, subtotal: round(m.price * quantity) };
  });

  const settings = await getSettings(tx);
  const totals = computeTotals(lines.reduce((s, l) => s + l.subtotal, 0), discount, type, settings);

  const order = await tx.order.create({
    data: {
      type,
      source,
      tableId: table?.id ?? null,
      tableNumber: table?.number ?? null,
      customerId: customerId || null,
      customerNote: String(customerNote || '').slice(0, 500),
      ...totals,
      items: { create: lines },
    },
    include: orderInclude,
  });
  await applyRecipeStock(tx, lines, -1, 'sale', order.id);
  return order;
}

module.exports = { round, orderInclude, getSettings, computeTotals, applyRecipeStock, createOrder };
