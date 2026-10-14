// Runs the Prisma CLI with the project's .env loaded, so `npm run db:migrate`
// reads the same root .env as the API and docker compose.
// Usage: node scripts/prisma.js <prisma args...>
const { spawnSync } = require('child_process');

const command = process.argv.slice(2);
if (command[0] !== 'generate') require('../lib/config'); // validates DATABASE_URL

const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...command], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://unused' },
});
process.exit(result.status ?? 1);
