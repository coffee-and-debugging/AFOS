// Staff directory, roles and payroll — managers only.
const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const { requireAuth, forgetAccount, ROLES } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { round } = require('../lib/orders');

const router = express.Router();
router.use(requireAuth(ROLES.ADMIN));
router.use('/categories', require('./staffCategories'));

const STAFF_ROLES = ['admin', 'cashier', 'chef', 'staff']; // staff = payroll only, no app access
const PAY_METHODS = ['cash', 'bank', 'esewa', 'khalti'];
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const MIN_PASSWORD = 6;

// Never send password hashes to the browser
const publicFields = {
  id: true, username: true, role: true, name: true, position: true, phone: true, active: true,
  baseSalary: true, overtimeRate: true, joinedAt: true, createdAt: true, categoryId: true,
  category: { select: { id: true, name: true, color: true } },
};

function money(value, name) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${name} must be zero or more`);
  return round(n);
}

function parseDateOnly(value, name) {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${name} is not a valid date`);
  return d;
}

async function parseCategoryId(value) {
  if (value === null || value === '' || value === undefined) return null;
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || !(await prisma.staffCategory.findUnique({ where: { id } }))) {
    throw new HttpError(400, 'Choose a valid staff category');
  }
  return id;
}

/** Validates staff details; `existing` is the current record when editing. */
async function parseStaff(body = {}, existing = null) {
  const name = String(body.name ?? existing?.name ?? '').trim();
  const role = String(body.role ?? existing?.role ?? '');
  if (!name) throw new HttpError(400, 'Name is required');
  if (!STAFF_ROLES.includes(role)) throw new HttpError(400, `Role must be one of: ${STAFF_ROLES.join(', ')}`);

  const canLogin = role !== 'staff';
  const username = canLogin ? String(body.username ?? existing?.username ?? '').trim().toLowerCase() : null;
  const password = body.password ? String(body.password) : '';
  if (canLogin) {
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new HttpError(400, 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore');
    }
    if (!existing?.password && !password) throw new HttpError(400, 'Set a password so they can sign in');
  }
  if (password && password.length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);

  return {
    name,
    role,
    username,
    // Payroll-only staff lose any old credentials; otherwise keep the current password unless a new one is set
    ...(!canLogin ? { password: null } : password ? { password: await bcrypt.hash(password, 10) } : {}),
    position: String(body.position ?? existing?.position ?? '').trim().slice(0, 60),
    categoryId: body.categoryId !== undefined ? await parseCategoryId(body.categoryId) : (existing?.categoryId ?? null),
    phone: String(body.phone ?? existing?.phone ?? '').trim().slice(0, 30),
    baseSalary: money(body.baseSalary ?? existing?.baseSalary, 'Base salary'),
    overtimeRate: money(body.overtimeRate ?? existing?.overtimeRate, 'Overtime rate'),
    ...(body.joinedAt && { joinedAt: parseDateOnly(body.joinedAt, 'Joining date') }),
  };
}

/** Refuses changes that would leave nobody able to manage the restaurant. */
async function assertAdminRemains(tx, userId, next) {
  const current = await tx.user.findUnique({ where: { id: userId } });
  const losingAdmin = current?.role === 'admin' && current.active && (next.role !== 'admin' || next.active === false);
  if (!losingAdmin) return;
  const otherAdmins = await tx.user.count({ where: { role: 'admin', active: true, id: { not: userId } } });
  if (otherAdmins === 0) throw new HttpError(409, 'Keep at least one active manager account');
}

const currentPeriod = () => new Date().toISOString().slice(0, 7);

// Directory with each person's payroll totals for a period (default: this month)
router.get('/', asyncHandler(async (req, res) => {
  const period = PERIOD.test(String(req.query.period)) ? String(req.query.period) : currentPeriod();
  // ?category=<id> or ?category=none for uncategorised staff
  const { category } = req.query;
  const where = category === 'none' ? { categoryId: null } : category ? { categoryId: Number(category) || -1 } : {};
  const [staff, paid] = await Promise.all([
    prisma.user.findMany({ where, select: publicFields, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    prisma.staffPayment.groupBy({ by: ['userId'], where: { period }, _sum: { netAmount: true }, _count: true }),
  ]);
  const lastPayments = await prisma.staffPayment.findMany({
    distinct: ['userId'],
    orderBy: { paidAt: 'desc' },
    select: { userId: true, paidAt: true, period: true, netAmount: true },
  });
  res.json(staff.map((s) => {
    const p = paid.find((x) => x.userId === s.id);
    return {
      ...s,
      canLogin: s.role !== 'staff',
      period,
      paidThisPeriod: round(p?._sum.netAmount || 0),
      paymentsThisPeriod: p?._count || 0,
      lastPayment: lastPayments.find((x) => x.userId === s.id) || null,
    };
  }));
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = await parseStaff(req.body);
  const created = await prisma.user.create({ data, select: publicFields });
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Staff member not found');
  const data = await parseStaff(req.body, existing);
  if (existing.id === req.user.id && data.role !== 'admin') throw new HttpError(409, 'You cannot remove your own manager role');

  const updated = await prisma.$transaction(async (tx) => {
    await assertAdminRemains(tx, existing.id, { role: data.role, active: existing.active });
    return tx.user.update({ where: { id: existing.id }, data, select: publicFields });
  });
  forgetAccount(existing.id);
  res.json(updated);
}));

// Deactivate (blocks sign-in immediately, keeps history) or reactivate
router.patch('/:id/active', asyncHandler(async (req, res) => {
  const active = Boolean(req.body?.active);
  if (req.params.id === req.user.id && !active) throw new HttpError(409, 'You cannot deactivate your own account');
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Staff member not found');
    await assertAdminRemains(tx, existing.id, { role: existing.role, active });
    return tx.user.update({ where: { id: existing.id }, data: { active }, select: publicFields });
  });
  forgetAccount(updated.id);
  res.json(updated);
}));

/* ---------- Payroll ---------- */

function parsePayment(body = {}, staff) {
  const period = String(body.period || currentPeriod());
  if (!PERIOD.test(period)) throw new HttpError(400, 'Period must look like 2026-10');
  const method = String(body.method || 'cash');
  if (!PAY_METHODS.includes(method)) throw new HttpError(400, `Payment method must be one of: ${PAY_METHODS.join(', ')}`);

  const baseAmount = money(body.baseAmount ?? staff.baseSalary, 'Base amount');
  const bonus = money(body.bonus, 'Bonus');
  const overtimeHours = money(body.overtimeHours, 'Overtime hours');
  const overtimeRate = money(body.overtimeRate ?? staff.overtimeRate, 'Overtime rate');
  const overtimeAmount = round(overtimeHours * overtimeRate);
  const deductions = money(body.deductions, 'Deductions');
  const netAmount = round(baseAmount + bonus + overtimeAmount - deductions);
  if (netAmount < 0) throw new HttpError(400, 'Deductions cannot exceed the total pay');

  return {
    period, method, baseAmount, bonus, overtimeHours, overtimeRate, overtimeAmount, deductions, netAmount,
    note: String(body.note || '').trim().slice(0, 300),
    paidAt: body.paidAt ? parseDateOnly(body.paidAt, 'Payment date') : new Date(),
  };
}

// All payouts in a period or date range, for the payroll ledger
router.get('/payments', asyncHandler(async (req, res) => {
  const { period, from, to } = req.query;
  if (period && !PERIOD.test(String(period))) throw new HttpError(400, 'Period must look like 2026-10');
  const where = {
    ...(period && { period: String(period) }),
    ...((from || to) && { paidAt: { ...(from && { gte: parseDateOnly(from, 'from') }), ...(to && { lt: parseDateOnly(to, 'to') }) } }),
  };
  res.json(await prisma.staffPayment.findMany({
    where,
    include: { user: { select: { id: true, name: true, role: true, position: true, category: { select: { id: true, name: true, color: true } } } } },
    orderBy: { paidAt: 'desc' },
    take: 1000,
  }));
}));

router.get('/:id/payments', asyncHandler(async (req, res) => {
  res.json(await prisma.staffPayment.findMany({ where: { userId: req.params.id }, orderBy: { paidAt: 'desc' }, take: 500 }));
}));

router.post('/:id/payments', asyncHandler(async (req, res) => {
  const staff = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!staff) throw new HttpError(404, 'Staff member not found');
  if (!staff.active) throw new HttpError(409, 'Reactivate this staff member before recording a payment');
  const payment = await prisma.staffPayment.create({
    data: { ...parsePayment(req.body, staff), userId: staff.id, recordedBy: req.user.name },
  });
  res.status(201).json(payment);
}));

// Remove a payout recorded by mistake
router.delete('/payments/:paymentId', asyncHandler(async (req, res) => {
  await prisma.staffPayment.delete({ where: { id: req.params.paymentId } });
  res.json({ success: true });
}));

module.exports = router;
