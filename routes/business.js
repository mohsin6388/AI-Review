const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/jwt')
const {
  getBusiness,
  getBusinessById, 
  createBusiness,
  deleteBusinessById,
  getQRCode,
  getStats,
} = require('../controllers/businessController');

// GET /api/business/:id
router.get("/:id", authMiddleware, getBusiness);

router.get("/review/:id", authMiddleware, getBusinessById);

// POST /api/business
router.post("/", authMiddleware, createBusiness);
  


// GET /api/business/:id/qr
router.get('/:id/qr', authMiddleware,  getQRCode);

// GET /api/business/:id/stats
router.get("/:id/stats", authMiddleware, getStats);


//GET /api/business/:id
router.delete("/:id", authMiddleware, deleteBusinessById);

module.exports = router;
