const express = require('express');
const {
  handleAdminLogin,
  getAllUsers,
  getUserPaymentDetails,
  getTerms,
  updateTerms,
  getPolicy,
  updatePolicy,
  addBusinessType,
  getBusinessTypes,
  deleteBusinessType,
  getDashboardStats,
} = require("../controllers/adminContoller");
const router = express.Router();


// =========  ADMIN LOGIN  =================

router.get('/auth/login', handleAdminLogin)


// ========  USER DETAILS ==================

router.get('/users', getAllUsers)


// ========  USER PAYMENT DETAILS ===========

router.get('/users/payment-details', getUserPaymentDetails)


// ========  TERMS AND CONDITION ==========

router.get('/terms-condition', getTerms)

router.put('/terms-condition', updateTerms)


// ======= PRIVACY POLICY ==============

router.get("/privacy-policy", getPolicy);

router.put("/privacy-policy", updatePolicy);


// ======  ADD BUSINESSES =============

router.get("/business-types", getBusinessTypes);

router.post("/business-types", addBusinessType);

router.delete("/business-types/:id", deleteBusinessType);


// ====== GET DASHBOARD STATS ============

router.get("/dashboard/stats", getDashboardStats);


module.exports= router;