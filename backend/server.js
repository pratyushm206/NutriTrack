const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 5000;

const configuredOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  console.warn('CORS_ORIGIN or FRONTEND_URL is not set. The API will reject browser requests in production.');
}

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || process.env.NODE_ENV !== 'production' || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
// Increase limits for base64 image uploads
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ limit: '8mb', extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const foodRoutes = require('./routes/food');
const exerciseRoutes = require('./routes/exercise');
const aiRoutes = require('./routes/ai');
const summaryRoutes = require('./routes/summary');

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/exercise', exerciseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/summary', summaryRoutes);

app.get('/', (req, res) => {
  res.send('NutriTrack API is running');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.message === 'Not allowed by CORS' ? 403 : 500;
  res.status(status).json({
    error: status === 403 ? 'Origin is not allowed.' : 'Something went wrong!',
    ...(process.env.NODE_ENV === 'production' ? {} : { details: err.message })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
