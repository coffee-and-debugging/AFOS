const { Prisma } = require('@prisma/client');
const multer = require('multer');
const logger = require('./logger');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 4 does not catch rejected promises; forward them to the error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function isDatabaseDown(err) {
  return (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && ['P1001', 'P1002', 'P1017'].includes(err.code))
  );
}

// Central error handler: always answers with JSON, never crashes the process.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message;
    return res.status(400).json({ error: message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'That value already exists' });
    if (err.code === 'P2003') return res.status(400).json({ error: 'The selected category or table no longer exists' });
  }
  if (isDatabaseDown(err)) {
    logger.error('database unavailable', { path: req.path, err });
    return res.status(503).json({ error: 'Database is temporarily unavailable. Please try again shortly.' });
  }

  logger.error('unhandled request error', { method: req.method, path: req.path, err });
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}

module.exports = { HttpError, asyncHandler, errorHandler };
