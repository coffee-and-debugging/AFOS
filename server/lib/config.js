// Loads .env files and validates configuration once at startup.
// Root .env is shared with docker compose and Vite; server/.env (optional) overrides it.
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: [path.join(__dirname, '../.env'), path.join(__dirname, '../../.env')],
  quiet: true,
});

function fail(problems) {
  const lines = [
    '',
    'AFOS API cannot start: invalid configuration.',
    ...problems.map((p) => `  - ${p}`),
    '',
    'Copy .env.example to .env in the project root and fill in the missing values.',
    '',
  ];
  console.error(lines.join('\n'));
  process.exit(1);
}

function load() {
  const env = process.env;
  const problems = [];

  if (!env.DATABASE_URL) {
    problems.push('DATABASE_URL is required (e.g. postgresql://afos:afos@localhost:5433/afos)');
  } else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    problems.push('DATABASE_URL must start with postgresql://');
  }

  if (!env.JWT_SECRET) {
    problems.push('JWT_SECRET is required (any long random string)');
  } else if (env.JWT_SECRET.length < 16) {
    problems.push('JWT_SECRET must be at least 16 characters');
  }

  const port = Number(env.PORT || env.API_PORT || 3001);
  if (!Number.isInteger(port) || port <= 0) problems.push('PORT must be a positive integer');

  const logLevel = env.LOG_LEVEL || 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    problems.push('LOG_LEVEL must be one of debug, info, warn, error');
  }

  for (const name of ['ESEWA_ENV', 'KHALTI_ENV']) {
    if (env[name] && !['test', 'live'].includes(env[name])) problems.push(`${name} must be test or live`);
  }

  if (problems.length) fail(problems);

  const isProd = env.NODE_ENV === 'production';
  const esewaEnv = env.ESEWA_ENV === 'live' ? 'live' : 'test';
  const khaltiEnv = env.KHALTI_ENV === 'live' ? 'live' : 'test';
  return {
    isProd,
    nodeEnv: env.NODE_ENV || 'development',
    port,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    logLevel,
    corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    uploadsDir: env.UPLOADS_DIR || path.join(__dirname, '../uploads'),
    trustProxy: env.TRUST_PROXY === 'true',
    payments: {
      // Where guests return after paying. Empty = the address the guest's browser is using.
      publicUrl: (env.PUBLIC_APP_URL || '').trim().replace(/\/+$/, ''),
      esewa: {
        env: esewaEnv,
        // eSewa's published sandbox merchant is used in test mode unless you set your own
        productCode: env.ESEWA_PRODUCT_CODE || (esewaEnv === 'test' ? 'EPAYTEST' : ''),
        secretKey: env.ESEWA_SECRET_KEY || (esewaEnv === 'test' ? '8gBm/:&EnhH.1/q' : ''),
        account: env.ESEWA_ACCOUNT || '9840040733',
      },
      khalti: {
        env: khaltiEnv,
        // Khalti's documented sandbox merchant is used in test mode unless you set your own
        secretKey: env.KHALTI_SECRET_KEY || (khaltiEnv === 'test' ? 'live_secret_key_68791341fdd94846a146f0457ff7b455' : ''),
        account: env.KHALTI_ACCOUNT || '9866028826',
      },
    },
  };
}

module.exports = load();
