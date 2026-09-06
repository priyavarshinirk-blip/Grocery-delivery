const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const darkStoreRoutes = require('./routes/darkStoreRoutes');
const productRoutes = require('./routes/productRoutes');
const storeStockRoutes = require('./routes/storeStockRoutes');
const orderRoutes = require('./routes/orderRoutes');
const deliveryPartnerRoutes = require('./routes/deliveryPartnerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Grocery delivery API is running',
    data: { healthCheck: '/api/health' },
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Service is healthy', data: { uptime: process.uptime() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/dark-stores', darkStoreRoutes);
app.use('/api/products', productRoutes);
app.use('/api/store-stock', storeStockRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery-partners', deliveryPartnerRoutes);
app.use('/api/reports', reportRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
