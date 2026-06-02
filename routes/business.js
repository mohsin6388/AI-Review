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
  handleGetBusinessType,
} = require("../controllers/businessController");


// GET /api/business/business-type
router.get('/type/business-type', handleGetBusinessType)

//GET /api/business/googlge-search
// router.get("/google-places/autocomplete", hanleGooglePlaces);


// GET /api/business/:id
router.get("/:id", authMiddleware, getBusiness);

// POST /api/business
router.post("/", authMiddleware, createBusiness);




// GET /api/business/:id/qr
router.get('/:id/qr', authMiddleware,  getQRCode);

// GET /api/business/:id/stats
router.get("/:id/stats", authMiddleware, getStats);


//public oute for review purpose not authentication use here
router.get("/review/:id", getBusinessById);

  



//GET /api/business/:id
router.delete("/:id", authMiddleware, deleteBusinessById);



module.exports = router;
