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
};

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

  const client = { res, user: req.user };
  clients.add(client);
  write(client, 'ready', { role: req.user.role }, nextEventId);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
}

/** Sends an event to every connected screen whose role may see it. Never throws. */
function publish(type, data) {
  const roles = AUDIENCE[type];
  if (!roles) throw new Error(`Unknown event type: ${type}`);
  const id = nextEventId++;
  for (const client of clients) {
    if (!roles.includes(client.user.role)) continue;
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

module.exports = { stream, publish, closeAll };
