const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  checkUserPaymentStatus,
} = require("../controllers/paymentController");

const authMiddleware = require("../middleware/jwt");


// Create Payment
router.post("/create-order", authMiddleware,  createOrder);
router.post("/verify-payment", authMiddleware,  verifyPayment);

router.get("/check-payment/:userId", authMiddleware, checkUserPaymentStatus);

module.exports = router;