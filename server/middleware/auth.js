const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../lib/config');
const prisma = require('../prisma');
const { hasFeature } = require('../lib/plans');

// Who may do what. admin = owner/manager, cashier = front of house, chef = kitchen.
const ROLES = {
  ADMIN: ['admin'],
  FRONT: ['admin', 'cashier'],
  STAFF: ['admin', 'cashier', 'chef'],
  KITCHEN: ['admin', 'chef'],
};

function requireAuth(roles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Please sign in to continue' });
    }
    try {
      const decoded = jwt.verify(authHeader.slice(7), jwtSecret);
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'You do not have access to this' });
      }
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Your session has expired, please sign in again' });
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

module.exports = { requireAuth, requireFeature, ROLES };
