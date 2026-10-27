// In-process real-time hub. Staff screens hold one Server-Sent Events stream
// (GET /api/events) and receive the events their role is allowed to see.
// Single-instance by design, like the rest of the API; to run several API replicas,
// fan `publish` out through Postgres LISTEN/NOTIFY or Redis pub/sub.
const logger = require('./logger');

const HEARTBEAT_MS = 25_000; // below common proxy idle timeouts (Nginx 60s, Heroku 55s)

// Which roles receive which event types.
const AUDIENCE = {
  'order.created': ['admin', 'cashier', 'chef'],
  'order.updated': ['admin', 'cashier', 'chef'],
  'stock.low': ['admin', 'cashier'],
  'chat.message': ['admin', 'cashier', 'chef'],
  'chat.read': ['admin', 'cashier', 'chef'],
  // Any saved change (menu, stock, staff, settings …): open screens reload that data at once
  'data.changed': ['admin', 'cashier', 'chef'],
};

// Guests (table QR pages, no sign-in) get only public data changes and updates to their own orders.
const GUEST_RESOURCES = ['menu', 'categories', 'restaurant', 'tables'];
const ORDER_EVENTS = ['order.created', 'order.updated'];

const clients = new Set();
let nextEventId = 1;

function write(client, type, data, id) {
  client.res.write(`id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Express handler that turns the request into an event stream. Mount behind requireAuth. */
function stream(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop Nginx from buffering the stream
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const client = { res, user: req.user, guestOrders: null };
  clients.add(client);
  write(client, 'ready', { role: req.user.role }, nextEventId);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
}

/**
 * Guest stream (no sign-in): GET /api/events/guest?orders=<id>,<id>. Order ids are the guest's own
 * (unguessable UUIDs they already hold), so they only ever hear about their own orders.
 */
function guestStream(req, res) {
  const ids = String(req.query.orders || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  req.user = { role: 'guest' };
  const orders = new Set(ids);
  stream(req, res);
  for (const client of clients) if (client.res === res) client.guestOrders = orders;
}

function guestMaySee(client, type, data) {
  if (type === 'data.changed') return GUEST_RESOURCES.includes(data?.resource);
  if (ORDER_EVENTS.includes(type)) return client.guestOrders.has(data?.id);
  return false;
}

/**
 * Sends an event to every connected screen whose role may see it. Never throws.
 * `onlyRoles` narrows the audience further, e.g. a chat message goes to its two roles only.
 */
function publish(type, data, onlyRoles) {
  const audience = AUDIENCE[type];
  if (!audience) throw new Error(`Unknown event type: ${type}`);
  const roles = onlyRoles ? audience.filter((r) => onlyRoles.includes(r)) : audience;
  const id = nextEventId++;
  for (const client of clients) {
    if (client.guestOrders ? !guestMaySee(client, type, data) : !roles.includes(client.user.role)) continue;
    try {
      write(client, type, data, id);
    } catch (err) {
      logger.warn('dropping event client', { type, err });
      clients.delete(client);
    }
  }
}

/** Closes every open stream so the server can shut down promptly. */
function closeAll() {
  for (const client of clients) client.res.end();
  clients.clear();
}

/**
 * Express middleware: after any successful change (POST/PUT/PATCH/DELETE) under /api, tells every open
 * screen which kind of data changed, so pages refresh without a reload. `resource` is the first path
 * segment, e.g. /api/stock/4/adjust → "stock".
 */
function broadcastChanges(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const resource = req.path.split('/')[1] || '';
  if (!resource || resource === 'auth' || resource === 'events') return next();
  res.on('finish', () => {
    if (res.statusCode < 400) publish('data.changed', { resource, at: new Date().toISOString() });
  });
  next();
}

module.exports = { stream, guestStream, publish, broadcastChanges, closeAll };
