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

  if (problems.length) fail(problems);

  const isProd = env.NODE_ENV === 'production';
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
  };
}

module.exports = load();
