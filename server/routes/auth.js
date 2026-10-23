const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const { jwtSecret } = require('../lib/config');
const { HttpError, asyncHandler } = require('../lib/http');
const { LOGIN_ROLES } = require('../middleware/auth');

const router = express.Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'Username and password are required');
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user?.password || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, 'Invalid username or password');
  }
  if (!user.active || !LOGIN_ROLES.includes(user.role)) {
    throw new HttpError(403, 'This account is deactivated. Please contact your manager.');
  }

  const profile = { id: user.id, username: user.username, role: user.role, name: user.name };
  const token = jwt.sign(profile, jwtSecret, { expiresIn: '12h' });
  res.json({ token, user: profile });
}));

module.exports = router;
