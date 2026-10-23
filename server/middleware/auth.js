const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../lib/config');
const prisma = require('../prisma');
const { hasFeature } = require('../lib/plans');

// Who may do what. admin = owner/manager, cashier = front of house, chef = kitchen.
// "staff" accounts exist only for payroll and can never sign in.
const ROLES = {
  ADMIN: ['admin'],
  FRONT: ['admin', 'cashier'],
  STAFF: ['admin', 'cashier', 'chef'],
  KITCHEN: ['admin', 'chef'],
};
const LOGIN_ROLES = ROLES.STAFF;

// Tokens live 12h, so the live account is re-checked (cached briefly) on each request:
// deactivating someone or changing their role takes effect within ACCOUNT_TTL_MS.
const ACCOUNT_TTL_MS = 15_000;
const accountCache = new Map();

async function loadAccount(id) {
  const hit = accountCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.account;
  const account = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, name: true, active: true } });
  accountCache.set(id, { account, expires: Date.now() + ACCOUNT_TTL_MS });
  return account;
}

/** Call after changing a user so the next request sees the new role/active state immediately. */
const forgetAccount = (id) => accountCache.delete(id);

function requireAuth(roles = []) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Please sign in to continue' });
    }
    let decoded;
    try {
      decoded = jwt.verify(authHeader.slice(7), jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Your session has expired, please sign in again' });
    }
    try {
      const account = await loadAccount(decoded.id);
      if (!account || !account.active || !LOGIN_ROLES.includes(account.role)) {
        return res.status(401).json({ error: 'Your account is no longer active, please contact your manager' });
      }
      if (roles.length && !roles.includes(account.role)) {
        return res.status(403).json({ error: 'You do not have access to this' });
      }
      req.user = { id: account.id, username: account.username, role: account.role, name: account.name };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Blocks premium features on plans that don't include them (HTTP 402, code feature_locked). */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const restaurant = await prisma.restaurant.findUnique({ where: { id: 1 }, select: { plan: true } });
      if (hasFeature(restaurant?.plan, feature)) return next();
      res.status(402).json({ error: 'This feature needs a plan upgrade', code: 'feature_locked', feature });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, requireFeature, forgetAccount, ROLES, LOGIN_ROLES };
