// Loads the demo restaurant (menu, stock, recipes, suppliers) into an existing database.
// Safe to re-run. Removes the old tea-shop sample items only when they are unedited and were never ordered.
require('../lib/config');
const prisma = require('../prisma');
const logger = require('../lib/logger');
const { LEGACY_SAMPLE, RESTAURANT, addDemoData } = require('./demo-data');

async function main() {
  const added = await addDemoData(prisma);

  let removed = 0;
  for (const [name, price] of LEGACY_SAMPLE) {
    const item = await prisma.menuItem.findFirst({ where: { name, price } });
    if (!item) continue;
    const ordered = await prisma.orderItem.count({ where: { menuItemId: String(item.id) } });
    if (ordered) continue;
    await prisma.menuItem.delete({ where: { id: item.id } });
    removed++;
  }
  for (const slug of ['tea', 'food']) {
    if ((await prisma.menuItem.count({ where: { category: slug } })) === 0) {
      await prisma.category.deleteMany({ where: { slug } });
    }
  }

  // Replace the tea-shop tagline only if nobody has changed it
  await prisma.restaurant.updateMany({
    where: { id: 1, tagline: 'Fresh tea & small plates' },
    data: { tagline: RESTAURANT.tagline },
  });

  logger.info('demo data loaded', { menuItemsAdded: added, sampleItemsRemoved: removed });
}

main()
  .catch((err) => {
    logger.fatal('demo load failed', { err });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
