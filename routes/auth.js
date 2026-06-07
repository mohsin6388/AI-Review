const express = require('express');
const router = express.Router();
const {
  handleSignUp,
  login,
  logout,
  handleForgotPassword,
  handleVerifyOTP,
  handleResetPassword,
  refreshAccessToken,
} = require("../controllers/authController");

// const {
//   handleGoogleAuth,
//   handleGoogleCallback,
//   handleSaveLocations,
// } = require("../controllers/googleAuthController");

const {registerSchema} = require('../validations/auth.validations')
const {loginSchema} = require("../validations/login.validations");
const {validate} = require('../middleware/validate')


// Sign Up
router.post("/signup", validate(registerSchema), handleSignUp);

router.post("/login", validate(loginSchema), login);

router.post("/refresh", refreshAccessToken);

router.post("/logout", logout);

router.post("/forgot-password", handleForgotPassword)

router.post("/verify-otp", handleVerifyOTP);

router.post("/create-password", handleResetPassword);

//=========================================
//      GOOGLE AUTH ROUTE
//=========================================

// router.get('/google', handleGoogleAuth)

// router.get("/google/callback", handleGoogleCallback)

// router.get("/google/business/location", handleSaveLocations);



module.exports = router;

