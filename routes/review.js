const express = require('express');
const router = express.Router();
const {
  generateReview,
  trackCopied,
  trackRedirected,
  saveFeedback,
  getReviewsByBusiness,
} = require("../controllers/reviewController");

// POST /api/review/generate
router.post('/generate', generateReview);

// POST /api/review/session/:id/copied
router.post('/session/:id/copied', trackCopied);

// POST /api/review/session/:id/redirected
router.post('/session/:id/redirected', trackRedirected);

// POST /api/review/feedback
router.post('/feedback', saveFeedback);

// GET /api/review/:businessId
router.get('/:businessId', getReviewsByBusiness);

module.exports = router;
