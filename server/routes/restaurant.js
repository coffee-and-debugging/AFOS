const express = require('express');
const prisma = require('../prisma');
const { requireAuth, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');

const router = express.Router();
const SETTINGS_ID = 1;
const TEXT_FIELDS = ['tagline', 'address', 'phone', 'receiptFooter'];

router.get('/', asyncHandler(async (req, res) => {
  const settings = await prisma.restaurant.findUnique({ where: { id: SETTINGS_ID } });
  if (!settings) throw new HttpError(404, 'Restaurant settings missing — run npm run db:seed');
  res.json(settings);
}));

function rate(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, `${name} must be between 0 and 100`);
  return n;
}

router.put('/', requireAuth(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const data = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw new HttpError(400, 'Name cannot be empty');
    data.name = String(body.name).trim();
  }
  if (body.currency !== undefined) {
    if (!String(body.currency).trim()) throw new HttpError(400, 'Currency cannot be empty');
    data.currency = String(body.currency).trim();
  }
  for (const key of TEXT_FIELDS) if (body[key] !== undefined) data[key] = String(body[key]).trim();
  if (body.taxRate !== undefined) data.taxRate = rate(body.taxRate, 'Tax rate');
  if (body.serviceChargeRate !== undefined) data.serviceChargeRate = rate(body.serviceChargeRate, 'Service charge');

  res.json(await prisma.restaurant.update({ where: { id: SETTINGS_ID }, data }));
}));

module.exports = router;
