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
  hanleGooglePlaces,
} = require("../controllers/businessController");

// GET /api/business/:id
router.get("/:id", authMiddleware, getBusiness);


//public oute for review purpose not authentication use here
router.get("/review/:id", getBusinessById);

// POST /api/business
router.post("/", authMiddleware, createBusiness);
  

// GET /api/business/:id/qr
router.get('/:id/qr', authMiddleware,  getQRCode);

// GET /api/business/:id/stats
router.get("/:id/stats", authMiddleware, getStats);


//GET /api/business/:id
router.delete("/:id", authMiddleware, deleteBusinessById);


//GET /api/business/googlge-search
router.get("/google-places/autocomplete", hanleGooglePlaces);

module.exports = router;
