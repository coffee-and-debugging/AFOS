// Minimal structured logger: one JSON object per line, easy to grep and ship to any log service.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const threshold = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

function serializeError(err) {
  if (!(err instanceof Error)) return err;
  return { name: err.name, message: err.message, code: err.code, stack: err.stack };
}

function write(level, msg, fields = {}) {
  if (LEVELS[level] < threshold) return;
  const entry = { time: new Date().toISOString(), level, msg };
  for (const [key, value] of Object.entries(fields)) {
    entry[key] = key === 'err' ? serializeError(value) : value;
  }
  const line = JSON.stringify(entry);
  if (LEVELS[level] >= LEVELS.error) process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  debug: (msg, fields) => write('debug', msg, fields),
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
  fatal: (msg, fields) => write('fatal', msg, fields),
};
