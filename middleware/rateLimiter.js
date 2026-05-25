const rateLimit = require('express-rate-limit');

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter for AI generation (prevent Gemini API abuse)
const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 AI generations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI generation limit reached. Please try again in an hour.' },
});

// Business creation limiter
const businessCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many business registrations. Please try again later.' },
});

module.exports = { apiLimiter, aiGenerationLimiter, businessCreateLimiter };
