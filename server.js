require('dotenv').config();
const express = require('express');
const cors = require('cors');
// const { initDB } = require('./db');
const businessRoutes = require('./routes/business');
const reviewRoutes = require('./routes/review');
const paymentRoutes = require('./routes/paymentRoutes')
const authRoutes = require('./routes/auth');
const { apiLimiter, aiGenerationLimiter, businessCreateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────
// app.use('/api/', apiLimiter);
// app.use('/api/review/generate', aiGenerationLimiter);
// app.use('/api/business', businessCreateLimiter);

// ─── Routes ──────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/payment', paymentRoutes);

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Review Rocket API',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ─── Start Server ─────────────────────────────────────────────
const startServer = async () => {
  try {
    // await initDB();
    app.listen(PORT, () => {
      console.log(`\n🚀 Review Rocket Backend running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
