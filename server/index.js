const config = require('./lib/config'); // must load first: reads .env and validates it
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const logger = require('./lib/logger');
const { errorHandler } = require('./lib/http');
const prisma = require('./prisma');
const events = require('./lib/events');
const { requireAuth, ROLES } = require('./middleware/auth');
const { version } = require('./package.json');
// Developed by Unique Adhikari

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', { err: reason });
});
process.on('uncaughtException', (err) => {
  // State may be corrupt after an uncaught exception: log, then exit so the
  // process manager (Docker restart policy / host) starts a clean instance.
  logger.fatal('uncaught exception, exiting', { err });
  setTimeout(() => process.exit(1), 100).unref();
});

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: config.isProd && {
    directives: {
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      // The eSewa checkout is a form POST to eSewa's site
      'form-action': ["'self'", 'https://rc-epay.esewa.com.np', 'https://epay.esewa.com.np'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // lets a separately hosted frontend load /uploads
}));
app.use(cors({ origin: config.corsOrigins, credentials: true }));

// Request log (skips health probes so uptime monitors don't flood the logs)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('request', { method: req.method, path: req.originalUrl, status: res.statusCode, ms: Math.round(ms) });
  });
  next();
});

async function health(req, res) {
  const dbUp = await prisma.isDatabaseHealthy();
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'up' : 'down',
    version,
    uptimeSeconds: Math.round(process.uptime()),
  });
}
app.get('/health', health);
app.get('/api/health', health);

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', events.broadcastChanges);

fs.mkdirSync(config.uploadsDir, { recursive: true });
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '1h' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurant', require('./routes/restaurant'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/chat', require('./routes/chat'));
// Live updates for staff screens (new orders → kitchen bell, low-stock popups, any data change)
app.get('/api/events', requireAuth(ROLES.STAFF), events.stream);
// Live updates for guest pages: public menu/table changes and their own orders only
app.get('/api/events/guest', events.guestStream);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// When the frontend has been built (npm run build), serve it with an SPA fallback
// so the whole app can run from one process. Separately hosted frontends skip this.
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.get(/^(?!\/(api|uploads)\/).*/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use(errorHandler);

let server;

async function start() {
  try {
    await prisma.connectWithRetry();
  } catch (err) {
    logger.fatal('could not connect to the database, giving up', { err });
    process.exit(1);
  }
  server = app.listen(config.port, () => {
    logger.info('api listening', { port: config.port, env: config.nodeEnv, version });
  });
}

function shutdown(signal) {
  logger.info('shutting down', { signal });
  const force = setTimeout(() => process.exit(1), 10000).unref();
  events.closeAll(); // open event streams would otherwise hold server.close() until the timeout
  const close = server ? (cb) => server.close(cb) : (cb) => cb();
  close(async () => {
    await prisma.$disconnect().catch(() => {});
    clearTimeout(force);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
