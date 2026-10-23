// Stock quantities are always stored in the item's base unit (e.g. single cigarettes).
// An item may also define a pack (e.g. 1 pack = 20 pcs) so it can be bought and counted in packs
// while menu items sell loose units — a recipe of 1 pcs sells one cigarette, 20 pcs a whole pack.
const { HttpError } = require('./http');
const events = require('./events');

const round3 = (n) => Math.round(n * 1000) / 1000;
const isLow = (item) => item.quantity <= item.reorderLevel;

const serializeStock = (item) => ({ ...item, lowStock: isLow(item) });

/** Converts a quantity entered in packs (when `inPacks`) to base units. */
function toBaseUnits(item, quantity, inPacks) {
  if (!inPacks) return quantity;
  if (!(item.unitsPerPack > 0)) throw new HttpError(400, `${item.name} has no pack size set`);
  return round3(quantity * item.unitsPerPack);
}

/**
 * Applies a change to one stock item, logs the movement, and returns
 * `{ item, alert }` where alert is set if this change just pushed it to or below
 * its reorder level, or out of stock.
 */
async function changeStock(tx, stockItemId, change, movement) {
  const item = await tx.stockItem.update({ where: { id: stockItemId }, data: { quantity: { increment: change } } });
  await tx.stockMovement.create({ data: { stockItemId, change, ...movement } });
  return { item, alert: lowStockAlert(item, item.quantity - change) };
}

function lowStockAlert(item, before) {
  const crossedLow = before > item.reorderLevel && isLow(item);
  const ranOut = before > 0 && item.quantity <= 0;
  if (!crossedLow && !ranOut) return null;
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    packUnit: item.packUnit,
    unitsPerPack: item.unitsPerPack,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    outOfStock: item.quantity <= 0,
  };
}

/** Broadcasts low-stock alerts to staff screens. Call only after the transaction commits. */
function notifyLowStock(alerts, source) {
  const items = alerts.filter(Boolean);
  if (items.length) events.publish('stock.low', { items, source, at: new Date().toISOString() });
}

module.exports = { round3, isLow, serializeStock, toBaseUnits, changeStock, notifyLowStock };
