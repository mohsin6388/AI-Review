const express = require('express');
const router = express.Router();
const {
  handleSignUp,
  login,
  handleForgotPassword,
  handleVerifyOTP,
  handleResetPassword,
} = require("../controllers/authController");


// Sign Up
router.post("/signup", handleSignUp);

router.post("/login", login);

router.post("/forgot-password", handleForgotPassword)

router.post("/verify-otp", handleVerifyOTP);

router.post("/create-password", handleResetPassword);


module.exports = router;

