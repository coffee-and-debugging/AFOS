const express = require('express');
const jwt = require('jsonwebtoken');
const store = require('../store');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = store.users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
});

module.exports = router;
