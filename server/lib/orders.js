// Shared order logic used by guest (QR) ordering and the POS.
const { HttpError } = require('./http');
const { round3, changeStock } = require('./stock');
// Developed by Unique Adhikari

const MAX_QTY_PER_ITEM = 50;
const round = (n) => Math.round(n * 100) / 100;

const orderInclude = {
  items: true,
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

/**
 * Adjusts stock for every ingredient used by the given order lines. sign = -1 consumes, +1 restores.
 * Recipe quantities are in each stock item's base unit, so fractional and loose-unit sales
 * (0.15 kg, 1 cigarette out of a pack of 20) deduct exactly.
 * Returns low-stock alerts for items this change pushed to or below their reorder level.
 */
async function applyRecipeStock(tx, lines, sign, reason, refId) {
  const ids = lines.map((l) => Number(l.menuItemId));
  const recipes = await tx.recipeItem.findMany({ where: { menuItemId: { in: ids } } });
  if (!recipes.length) return [];

  const totals = new Map();
  for (const line of lines) {
    const share = line.portion === 'half' ? 0.5 : 1; // a half plate uses half the recipe
    for (const r of recipes.filter((x) => x.menuItemId === Number(line.menuItemId))) {
      totals.set(r.stockItemId, (totals.get(r.stockItemId) || 0) + r.quantity * line.quantity * share);
    }
  }
  const alerts = [];
  // Fixed order so concurrent orders lock stock rows consistently and cannot deadlock
  for (const [stockItemId, qty] of [...totals].sort((a, b) => a[0] - b[0])) {
    const { alert } = await changeStock(tx, stockItemId, round3(sign * qty), { reason, refId });
    if (alert) alerts.push(alert);
  }
  return alerts;
}

/**
 * Validates the requested lines against the live menu and creates the order + stock movements.
 * Returns `{ order, stockAlerts }`; publish the alerts only after the transaction commits.
 */
async function createOrder(tx, { items, type = 'dine_in', source, tableId, customerNote, discount }) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Add at least one item to the order');
  if (!['dine_in', 'takeaway'].includes(type)) throw new HttpError(400, 'Order type must be dine-in or takeaway');

  let table = null;
  if (type === 'dine_in') {
    if (!tableId) throw new HttpError(400, 'Choose a table for dine-in orders');
    table = await tx.table.findUnique({ where: { id: String(tableId) } });
    if (!table) throw new HttpError(404, 'Table not found');
  }

  const requested = items.map((i) => ({
    id: Number.parseInt(i.menuItemId, 10),
    quantity: Number(i.quantity),
    portion: i.portion === 'half' ? 'half' : 'full',
  }));
  for (const { id, quantity } of requested) {
    if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid menu item');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
      throw new HttpError(400, `Quantity must be between 1 and ${MAX_QTY_PER_ITEM}`);
    }
  }

  const menuItems = await tx.menuItem.findMany({ where: { id: { in: requested.map((r) => r.id) } } });
  const lines = requested.map(({ id, quantity, portion }) => {
    const m = menuItems.find((x) => x.id === id);
    if (!m) throw new HttpError(400, 'One of the items is no longer on the menu');
    if (!m.available) throw new HttpError(400, `${m.name} is not available right now`);
    if (portion === 'half' && m.halfPrice == null) throw new HttpError(400, `${m.name} is not available as a half plate`);
    const price = portion === 'half' ? m.halfPrice : m.price;
    // The portion is part of the line's name, so kitchen tickets, bills and reports all show it
    const name = portion === 'half' ? `${m.name} (Half plate)` : m.name;
    return { menuItemId: String(m.id), name, category: m.category, price, quantity, subtotal: round(price * quantity), portion };
  });

  const settings = await getSettings(tx);
  const totals = computeTotals(lines.reduce((s, l) => s + l.subtotal, 0), discount, type, settings);

  const order = await tx.order.create({
    data: {
      type,
      source,
      tableId: table?.id ?? null,
      tableNumber: table?.number ?? null,
      customerNote: String(customerNote || '').slice(0, 500),
      ...totals,
      items: { create: lines },
    },
    include: orderInclude,
  });
  const stockAlerts = await applyRecipeStock(tx, lines, -1, 'sale', order.id);
  return { order, stockAlerts };
}

module.exports = { round, orderInclude, getSettings, computeTotals, applyRecipeStock, createOrder };
