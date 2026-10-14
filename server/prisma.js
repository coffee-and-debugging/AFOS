const { PrismaClient } = require('@prisma/client');
const logger = require('./lib/logger');

const prisma = new PrismaClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry with capped exponential backoff so the API survives starting before the database.
async function connectWithRetry({ maxAttempts = 30, maxDelayMs = 10000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      logger.info('database connected', { attempt });
      return;
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const delay = Math.min(1000 * 2 ** (attempt - 1), maxDelayMs);
      logger.warn('database not reachable, retrying', { attempt, retryInMs: delay, reason: err.message.split('\n').pop() });
      await sleep(delay);
    }
  }
}

async function isDatabaseHealthy() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

module.exports = prisma;
module.exports.connectWithRetry = connectWithRetry;
module.exports.isDatabaseHealthy = isDatabaseHealthy;
