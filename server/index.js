require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const tablesRoutes = require('./routes/tables');
const ordersRoutes = require('./routes/orders');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/orders', ordersRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' }));

// Serve built React app in production
if (isProd) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AFOS server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  if (!isProd) console.log('Credentials: admin/admin123 | chef/chef123');
});
