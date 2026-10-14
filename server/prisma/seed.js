// Idempotent seed: safe to run on every deploy. Existing rows are never duplicated
// or overwritten, so changes made in the admin panel survive re-seeding.
const config = require('../lib/config');
const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const logger = require('../lib/logger');
const { RESTAURANT, addDemoData } = require('./demo-data');

const TABLE_COUNT = 8;

function seedPassword(envName, devDefault) {
  const value = process.env[envName];
  if (value) return value;
  if (config.isProd) {
    throw new Error(`${envName} must be set when seeding in production (refusing to create a default password)`);
  }
  return devDefault;
}

async function main() {
  const users = [
    { id: '1', username: 'admin', role: 'admin', name: 'Admin', password: seedPassword('SEED_ADMIN_PASSWORD', 'admin123') },
    { id: '2', username: 'chef', role: 'chef', name: 'Chef', password: seedPassword('SEED_CHEF_PASSWORD', 'chef123') },
    { id: '3', username: 'cashier', role: 'cashier', name: 'Cashier', password: seedPassword('SEED_CASHIER_PASSWORD', 'cashier123') },
  ];
  for (const { password, ...user } of users) {
    if (await prisma.user.findUnique({ where: { username: user.username } })) continue;
    await prisma.user.create({ data: { ...user, password: await bcrypt.hash(password, 10) } });
  }

  await prisma.restaurant.upsert({ where: { id: RESTAURANT.id }, update: {}, create: RESTAURANT });

  // A brand-new install gets the demo restaurant; an existing menu is never touched.
  const freshInstall = (await prisma.menuItem.count()) === 0;
  if (freshInstall) await addDemoData(prisma);

  if ((await prisma.table.count()) === 0) {
    for (let number = 1; number <= TABLE_COUNT; number++) {
      await prisma.table.create({ data: { id: `table-${number}`, number } });
    }
  }

  logger.info('seed complete', { demoDataAdded: freshInstall });
}

main()
  .catch((err) => {
    logger.fatal('seed failed', { err });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
