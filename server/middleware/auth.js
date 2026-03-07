const jwt = require('jsonwebtoken');

const JWT_SECRET = 'afos-tea-shop-secret-2024';

function requireAuth(roles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = { requireAuth, JWT_SECRET };
