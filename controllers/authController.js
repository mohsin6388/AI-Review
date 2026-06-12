require("dotenv").config();
const pool = require("../db/index");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const crypto = require("crypto");
const nodemailer = require("nodemailer");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../middleware/generateToken");
const { success } = require("zod");




//===================================
//          REGISTER
//===================================

async function handleSignUp(req, res) {
  try {
    const { name, email, password } = req.body;

    // check existing user
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: "User already exists",
        success: false
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create user
    const newUser = await pool.query(
      `
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, name, email
      `,
      [name, email, hashedPassword],
    );

    const user = newUser.rows[0];

    // =========================
    // GET FREE PLAN
    // =========================

    const freePlanResult = await pool.query(
      `
      SELECT *
      FROM subscription_plans
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
      `,
      ["Free"],
    );

    if (freePlanResult.rows.length === 0) {
      return res.status(500).json({
        message: "Free subscription plan not found",
        success: false
      });
    }

    const freePlan = freePlanResult.rows[0];

    // =========================
    // INSERT SUBSCRIPTION
    // =========================

    const startDate = new Date();

    const endDate = new Date();

    endDate.setDate(
      endDate.getDate() + freePlan.duration_days
    );

    await pool.query(
      `
      INSERT INTO subscriptions
      (
        user_id,
        plan_id,
        status,
        start_date,
        end_date
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        user.id,
        freePlan.id,
        "active",
        startDate,
        endDate,
      ],
    );

    // =========================
    // GENERATE TOKEN
    // =========================

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

      //======= SAVE REFRESH TOKEN IN DB =========

      await pool.query(
        `
  INSERT INTO refresh_tokens
  (user_id, token_hash, expires_at)
  VALUES ($1, $2, $3)
  `,
        [user.id, tokenHash, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)],
      );





    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true, //true,
      sameSite: "none",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, //true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: "Login Successfull",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });



    // res.status(201).json({
    //   message: "User registered successfully",
    //   token,
    //   user,
    //   refreshToken,
    // });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
}




//================================
//          LOGIN
//================================

async function login(req, res) {
  try {
    const { email, password } = req.body;

    // find user
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid Email or Password",
        success: false
      });
    }

    const existingUser = user.rows[0];

    // compare password
    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid Email or Password",
        success: false
      });
    }

    // =========================
    // GENERATE TOKEN
    // =========================

    const accessToken = generateAccessToken(existingUser);
    const refreshToken = generateRefreshToken(existingUser);

    console.log(accessToken);
    console.log(refreshToken);

    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    //======= SAVE REFRESH TOKEN IN DB =========

    await pool.query(
      `
      INSERT INTO refresh_tokens
      (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [
        existingUser.id,
        tokenHash,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ],
    );


    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: "Sign Up Successful",
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
      },

    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
}





//=================================
//         LOGOUT
//=================================

const logout = async (req, res) => {

  const refreshToken = req.cookies.refreshToken;

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  await pool.query(
    `
  DELETE FROM refresh_tokens
  WHERE token_hash = $1
  `,
    [tokenHash],
  );

  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: false,  //process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,  //process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};





//=================================
//      REFRESH TOKEN VERIFY
//=================================

const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        code: "NO_REFRESH_TOKEN",
      });
    }
  
    // Hash incoming refresh token
    const oldTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Check token exists in DB
    const { rows } = await pool.query(
      `
      SELECT *
      FROM refresh_tokens
      WHERE token_hash = $1
      AND expires_at > NOW()
      `,
      [oldTokenHash],
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    // Verify JWT signature + expiry
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Delete old refresh token (Rotation)
    await pool.query(
      `
      DELETE FROM refresh_tokens
      WHERE token_hash = $1
      `,
      [oldTokenHash],
    );

    // Generate new tokens
    const accessToken = generateAccessToken(decoded);

    const newRefreshToken = generateRefreshToken(decoded);


    // Hash new refresh token
    const newTokenHash = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");

    // Save new refresh token hash
    await pool.query(
      `
      INSERT INTO refresh_tokens
      (
        user_id,
        token_hash,
        expires_at
      )
      VALUES
      (
        $1,
        $2,
        NOW() + INTERVAL '30 days'
      )
      `,
      [decoded.id, newTokenHash],
    );

    // Set new access token cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false, //process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    // Set new refresh token cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: false, //process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: "REFRESH_TOKEN_EXPIRED",
      message: "Please login again",
    });
  }
};





//=======================================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "mohsin06388@gmail.com", //process.env.GMAIL_USER, // aapki gmail: abc@gmail.com
    pass: "junx kapz apzu zzdk", //process.env.GMAIL_APP_PASS, // Gmail App Password (16 char)
  },
});

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function otpEmailHTML(otp) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e5e5e5; border-radius: 12px;">
      <h2 style="color: #1a1a1a; margin-bottom: 8px;">Password Reset OTP</h2>
      <p style="color: #6b6b68; font-size: 14px;">Aapne password reset request ki hai. Neeche diya code use karo:</p>
      <div style="background: #f1efe8; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #534AB7;">${otp}</span>
      </div>
      <p style="color: #6b6b68; font-size: 13px;">Yeh code <strong>10 minute</strong> mein expire ho jaayega.</p>
      <p style="color: #9a9a96; font-size: 12px; margin-top: 24px;">
        Agar aapne yeh request nahi ki toh is email ko ignore kar do.
      </p>
    </div>
  `;
}

async function handleForgotPassword(req, res) {
  const { email } = req.body;

  console.log(email);

  // ── Validate ─────────────────────────────────────────────────
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Valid email daalo" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // ── Check karo user exist karta hai ya nahi ───────────────
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );

    // Security: user mile ya na mile, same response do
    // (attacker ko pata na chale ki email registered hai ya nahi)
    if (userResult.rows.length === 0) {
      return res.status(200).json({
        message: "Agar yeh email registered hai toh OTP bhej diya gaya hai",
      });
    }

    // ── OTP generate karo ─────────────────────────────────────
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // ── Purane OTP delete karo (same email ke) ────────────────
    await pool.query("DELETE FROM password_reset_otps WHERE email = $1", [
      normalizedEmail,
    ]);

    // ── Naya OTP save karo ────────────────────────────────────
    await pool.query(
      `INSERT INTO password_reset_otps (email, otp_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [normalizedEmail, otpHash, expiresAt],
    );

    // ── Email bhejo ───────────────────────────────────────────
    await transporter.sendMail({
      from: `"Support" <${process.env.GMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Password Reset OTP",
      html: otpEmailHTML(otp),
    });

    return res.status(200).json({
      message: "OTP bhej diya gaya hai, 10 minute mein expire hoga",
    });
  } catch (err) {
    console.error("handleForgotPassword error:", err);
    return res
      .status(500)
      .json({ message: "Server error, baad mein try karo" });
  }
}

async function handleVerifyOTP(req, res) {
  const { email, otp } = req.body;

  console.log({ email, otp });

  // ── Validate ─────────────────────────────────────────────────
  if (!email || !otp) {
    return res.status(400).json({ message: "Email aur OTP dono chahiye" });
  }
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "OTP 6 digits ka hona chahiye" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // ── DB se OTP fetch karo ──────────────────────────────────
    const result = await pool.query(
      `SELECT otp_hash, expires_at
       FROM password_reset_otps
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ message: "OTP nahi mila, pehle request karo" });
    }

    const { otp_hash, expires_at } = result.rows[0];

    // ── Expiry check ──────────────────────────────────────────
    if (new Date() > new Date(expires_at)) {
      // Expired OTP delete karo
      await pool.query("DELETE FROM password_reset_otps WHERE email = $1", [
        normalizedEmail,
      ]);
      return res
        .status(400)
        .json({ message: "OTP expire ho gaya, dobara request karo" });
    }

    // ── OTP match karo ────────────────────────────────────────
    const isMatch = await bcrypt.compare(otp, otp_hash);

    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Galat OTP hai, dobara try karo" });
    }

    // ── OTP sahi hai — delete karo (ek baar hi use ho) ───────
    await pool.query("DELETE FROM password_reset_otps WHERE email = $1", [
      normalizedEmail,
    ]);

    // ── Ek short-lived reset token do (ResetPassword step ke liye) ─
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await pool.query(
      `UPDATE users
       SET reset_token = $1, reset_token_expires = $2
       WHERE email = $3`,
      [resetTokenHash, tokenExpiry, normalizedEmail],
    );

    return res.status(200).json({
      message: "OTP verify ho gaya",
      email: email,
      resetToken, // frontend ko do — ResetPassword API mein bhejo
      email: normalizedEmail,
    });
  } catch (err) {
    console.error("handleVerifyOTP error:", err);
    return res
      .status(500)
      .json({ message: "Server error, baad mein try karo" });
  }
}

async function handleResetPassword(req, res) {
  try {
    const { email, resetToken, newPassword } = req.body;

    // ── Validate ─────────────────────────────────────────────
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Sab fields required hain",
      });
    }

    // Password validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password kam se kam 6 characters ka hona chahiye",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── User fetch karo ──────────────────────────────────────
    const userResult = await pool.query(
      `
      SELECT id, reset_token, reset_token_expires
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail],
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User nahi mila",
      });
    }

    const user = userResult.rows[0];

    // ── Token exists? ────────────────────────────────────────
    if (!user.reset_token || !user.reset_token_expires) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset session",
      });
    }

    // ── Expiry check ─────────────────────────────────────────
    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({
        success: false,
        message: "Reset token expire ho gaya",
      });
    }

    // ── Token compare ────────────────────────────────────────
    const isTokenMatch = await bcrypt.compare(resetToken, user.reset_token);

    if (!isTokenMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset token",
      });
    }

    // ── Password hash ────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ── Password update ──────────────────────────────────────
    await pool.query(
      `
      UPDATE users
      SET
        password = $1,
        reset_token = NULL,
        reset_token_expires = NULL
      WHERE email = $2
      `,
      [hashedPassword, normalizedEmail],
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("handleResetPassword error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}



module.exports = {
  handleSignUp,
  login,
  logout,
  handleForgotPassword,
  handleVerifyOTP,
  handleResetPassword,
  refreshAccessToken,
};
