// Sets the restaurant's subscription plan, e.g.  npm run plan -- free
// Stand-in for a billing provider webhook until real subscriptions exist.
require('../lib/config');
const prisma = require('../prisma');
const { PLANS } = require('../lib/plans');

const plan = process.argv[2];
(async () => {
  if (!PLANS.includes(plan)) {
    const current = await prisma.restaurant.findUnique({ where: { id: 1 }, select: { plan: true } });
    console.log(`Current plan: ${current?.plan ?? 'unknown'}\nUsage: npm run plan -- <${PLANS.join('|')}>`);
    process.exitCode = plan ? 1 : 0;
    return;
  }
  await prisma.restaurant.update({ where: { id: 1 }, data: { plan } });
  console.log(`Plan set to ${plan}.`);
})().finally(() => prisma.$disconnect());
