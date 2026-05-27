require("dotenv").config();
const pool = require("../db/index");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const crypto = require("crypto");

// =============== LOGIN API =====================
async function handleAdminLogin(req, res) {

  try{

    const { email, password } = req.body;

    // find user
    const user = await pool.query("SELECT * FROM admin_users WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid Email or Password",
      });
    }

    const existingUser = user.rows[0];

    // compare password
    // const isMatch = await bcrypt.compare(password, existingUser.password);
    if(password !== existingUser.password){
       return res.status(400).json({
        message: "Invalid Email or Password",
      });
    }

    // if (!isMatch) {
    //   return res.status(400).json({
    //     message: "Invalid Email or Password",
    //   });
    // }

    // create token
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.status(200).json({
      message: "Login Successful",
      token,
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
      },
    });


  } catch(err) {
    res.status(500).json({message: "Internal Server Error", error: err})
  }

}



//============ GET USERS =========================

// const getAllUsers = async (req, res) => {
//   try {
//     // ---------------- TOTAL USERS ----------------
//     const totalUsersQuery = `
//       SELECT COUNT(*) AS total_users
//       FROM users
//     `;

//     // ---------------- ACTIVE USERS ----------------
//     const activeUsersQuery = `
//       SELECT COUNT(*) AS active_users
//       FROM users
//       WHERE subscription_status = 'active'
//     `;

//     // ---------------- NON ACTIVE USERS ----------------
//     const nonActiveUsersQuery = `
//       SELECT COUNT(*) AS non_active_users
//       FROM users
//       WHERE subscription_status != 'active'
//     `;

//     // ---------------- USERS DATA ----------------
//     const usersQuery = `
//       SELECT
//         u.id,
//         u.name,
//         u.email,
//         u.plan_type,
//         u.subscription_status,
//         u.created_at,

//         -- SUBSCRIPTION DETAILS
//         sub.start_date AS subscription_start_date,
//         sub.end_date AS subscription_end_date,
//         sub.status AS subscription_current_status,

//         -- PAYMENT DETAILS
//         pay.paid_at AS last_payment_date,
//         pay.payment_method,
//         pay.amount AS last_payment_amount,

//         -- TOTAL BUSINESSES
//         COUNT(b.id)::INTEGER AS total_businesses,

//         -- TOTAL REVIEWS
//         COALESCE(
//           SUM(b.total_reviews_generated),
//           0
//         )::INTEGER AS total_reviews,

//         -- BUSINESSES ARRAY
//         COALESCE(
//           JSON_AGG(
//             DISTINCT JSONB_BUILD_OBJECT(
//               'business_id', b.id,
//               'business_name', b.name,
//               'business_type', b.type,
//               'reviews_generated', b.total_reviews_generated,
//               'google_place_id', b.google_place_id,
//               'created_at', b.created_at
//             )
//           ) FILTER (WHERE b.id IS NOT NULL),
//           '[]'
//         ) AS businesses

//       FROM users u

//       -- BUSINESSES
//       LEFT JOIN businesses b
//       ON u.id = b.user_id

//       -- LATEST SUBSCRIPTION
//       LEFT JOIN LATERAL (
//         SELECT
//           s.start_date,
//           s.end_date,
//           s.status
//         FROM subscriptions s
//         WHERE s.user_id = u.id
//         ORDER BY s.created_at DESC
//         LIMIT 1
//       ) sub ON true

//       -- LATEST PAYMENT
//       LEFT JOIN LATERAL (
//         SELECT
//           p.paid_at,
//           p.payment_method,
//           p.amount
//         FROM payments p
//         WHERE p.user_id = u.id
//         ORDER BY p.created_at DESC
//         LIMIT 1
//       ) pay ON true

//       GROUP BY
//         u.id,
//         u.name,
//         u.email,
//         u.plan_type,
//         u.subscription_status,
//         u.created_at,
//         sub.start_date,
//         sub.end_date,
//         sub.status,
//         pay.paid_at,
//         pay.payment_method,
//         pay.amount

//       ORDER BY u.created_at DESC
//     `;

//     // ---------------- EXECUTE QUERIES ----------------
//     const [totalUsers, activeUsers, nonActiveUsers, users] = await Promise.all([
//       pool.query(totalUsersQuery),
//       pool.query(activeUsersQuery),
//       pool.query(nonActiveUsersQuery),
//       pool.query(usersQuery),
//     ]);

//     console.log("Users Data ===>", JSON.stringify(users.rows, null, 2));

//     // ---------------- RESPONSE ----------------
//     res.status(200).json({
//       success: true,

//       counts: {
//         totalUsers: Number(totalUsers.rows[0].total_users),

//         activeUsers: Number(activeUsers.rows[0].active_users),

//         nonActiveUsers: Number(nonActiveUsers.rows[0].non_active_users),
//       },

//       users: users.rows,
//     });
//   } catch (error) {
//     console.log(error);

//     res.status(500).json({
//       success: false,
//       message: "Server Error",
//     });
//   }
// };


const getAllUsers = async (req, res) => {
  try {
    // ---------------- TOTAL USERS ----------------
    const totalUsersQuery = `
      SELECT COUNT(*) AS total_users
      FROM users
    `;

    // ---------------- ACTIVE USERS ----------------
    const activeUsersQuery = `
      SELECT COUNT(*) AS active_users
      FROM subscriptions
      WHERE status = 'active'
    `;

    // ---------------- NON ACTIVE USERS ----------------
    const nonActiveUsersQuery = `
      SELECT COUNT(*) AS non_active_users
      FROM subscriptions
      WHERE status != 'active'
    `;

    // ---------------- USERS DATA ----------------
    const usersQuery = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,

        -- SUBSCRIPTION DETAILS
        sub.status AS subscription_status,
        sub.start_date AS subscription_start_date,
        sub.end_date AS subscription_end_date,

        -- PLAN DETAILS
        sp.name AS plan_name,
        sp.price AS plan_price,

        -- PAYMENT DETAILS
        pay.paid_at AS last_payment_date,
        pay.payment_method,
        pay.amount AS last_payment_amount,

        -- TOTAL BUSINESSES
        COUNT(b.id)::INTEGER AS total_businesses,

        -- TOTAL REVIEWS
        COALESCE(
          SUM(b.total_reviews_generated),
          0
        )::INTEGER AS total_reviews,

        -- BUSINESSES ARRAY
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'business_id', b.id,
              'business_name', b.name,
              'business_type', b.type,
              'reviews_generated', b.total_reviews_generated,
              'google_place_id', b.google_place_id,
              'created_at', b.created_at
            )
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'
        ) AS businesses

      FROM users u

      -- USER BUSINESSES
      LEFT JOIN businesses b
      ON u.id = b.user_id

      -- LATEST SUBSCRIPTION
      LEFT JOIN LATERAL (
        SELECT
          s.id,
          s.plan_id,
          s.status,
          s.start_date,
          s.end_date
        FROM subscriptions s
        WHERE s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) sub ON true

      -- PLAN DETAILS
      LEFT JOIN subscription_plans sp
      ON sub.plan_id = sp.id

      -- LATEST PAYMENT
      LEFT JOIN LATERAL (
        SELECT
          p.paid_at,
          p.payment_method,
          p.amount
        FROM payments p
        WHERE p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 1
      ) pay ON true

      GROUP BY
        u.id,
        u.name,
        u.email,
        u.created_at,

        sub.status,
        sub.start_date,
        sub.end_date,

        sp.name,
        sp.price,

        pay.paid_at,
        pay.payment_method,
        pay.amount

      ORDER BY u.created_at DESC
    `;

    // ---------------- EXECUTE QUERIES ----------------
    const [totalUsers, activeUsers, nonActiveUsers, users] = await Promise.all([
      pool.query(totalUsersQuery),
      pool.query(activeUsersQuery),
      pool.query(nonActiveUsersQuery),
      pool.query(usersQuery),
    ]);

    console.log("Users Data ===>", JSON.stringify(users.rows, null, 2));

    // ---------------- RESPONSE ----------------
    res.status(200).json({
      success: true,

      counts: {
        totalUsers: Number(totalUsers.rows[0].total_users),

        activeUsers: Number(activeUsers.rows[0].active_users),

        nonActiveUsers: Number(nonActiveUsers.rows[0].non_active_users),
      },

      users: users.rows,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};














//================= GET USER PAYMENT DETAILS =================

const getUserPaymentDetails = async (req, res) => {

  try {
    // =========================================
    // ALL PAYMENTS
    // =========================================

    const paymentsResult = await pool.query(
      `
        SELECT
          p.id,
          p.amount,
          p.status,
          p.payment_method,
          p.razorpay_payment_id,
          p.created_at,

          u.name,
          u.email

        FROM payments p

        JOIN users u
        ON u.id = p.user_id

        ORDER BY p.created_at DESC
        `,
    );

    // =========================================
    // TOTAL REVENUE
    // =========================================

    const totalRevenueResult = await pool.query(
      `
        SELECT
          COALESCE(SUM(amount), 0)
          AS total_revenue

        FROM payments

        WHERE status = 'success'
        `,
    );

    // =========================================
    // TODAY REVENUE
    // =========================================

    const todayRevenueResult = await pool.query(
      `
        SELECT
          COALESCE(SUM(amount), 0)
          AS today_revenue

        FROM payments

        WHERE
          status = 'success'

          AND DATE(created_at)
          = CURRENT_DATE
        `,
    );

    // =========================================
    // SUCCESS PAYMENTS
    // =========================================

    const successPaymentsResult = await pool.query(
      `
        SELECT COUNT(*) AS success_count

        FROM payments

        WHERE status = 'success'
        `,
    );

    // =========================================
    // FAILED PAYMENTS
    // =========================================

    const failedPaymentsResult = await pool.query(
      `
        SELECT COUNT(*) AS failed_count

        FROM payments

        WHERE status = 'failed'
        `,
    );

    // =========================================
    // RESPONSE
    // =========================================

    return res.status(200).json({
      success: true,

      analytics: {
        totalRevenue: totalRevenueResult.rows[0].total_revenue,

        todayRevenue: todayRevenueResult.rows[0].today_revenue,

        successPayments: successPaymentsResult.rows[0].success_count,

        failedPayments: failedPaymentsResult.rows[0].failed_count,
      },

      payments: paymentsResult.rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }

}














//=============================================================
// ================ TERMS AND CONDITIONS ==================
//=============================================================



// ================== GET TERMS & CONDITIONS ===============================

const getTerms = async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT *
      FROM terms_conditions
      LIMIT 1
    `);

    res.json(result.rows[0]);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};



// =================== UPDATE TERMS  ========================================

const updateTerms = async (req, res) => {
  try {

    const { content } = req.body;

    console.log(req.body)

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Content is required",
      });
    }

    // get current version
    const oldTerms = await pool.query(`
      SELECT version
      FROM terms_conditions
      LIMIT 1
    `);

    let newVersion = "v1.0";

    if (oldTerms.rows.length > 0) {

      const currentVersion =
        parseFloat(
          oldTerms.rows[0].version.replace("v", "")
        );

      newVersion =
        `v${(currentVersion + 0.1).toFixed(1)}`;
    }

    const result = await pool.query(`
      UPDATE terms_conditions
      SET
        content = $1,
        version = $2,
        updated_at = NOW()
      RETURNING *
    `,
    [
      content,
      newVersion
    ]);

    res.json({
      success: true,
      message: "Terms updated successfully",
      data: result.rows[0],
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};








//=============================================================
// ================ PRIVACY POLICY  ==========================
//=============================================================


// ================== GET TERMS & CONDITIONS ===============================

const getPolicy = async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT *
      FROM privacy_policy
      LIMIT 1
    `);

    res.json(result.rows[0]);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


// =================== UPDATE TERMS  ========================================

const updatePolicy = async (req, res) => {
  try {

    const { content } = req.body;

    console.log(req.body)

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Content is required",
      });
    }

    // get current version
    const oldTerms = await pool.query(`
      SELECT version
      FROM privacy_policy
      LIMIT 1
    `);

    let newVersion = "v1.0";

    if (oldTerms.rows.length > 0) {

      const currentVersion =
        parseFloat(
          oldTerms.rows[0].version.replace("v", "")
        );

      newVersion =
        `v${(currentVersion + 0.1).toFixed(1)}`;
    }

    const result = await pool.query(`
      UPDATE privacy_policy
      SET
        content = $1,
        version = $2,
        updated_at = NOW()
      RETURNING *
    `,
    [
      content,
      newVersion
    ]);

    res.json({
      success: true,
      message: "Terms updated successfully",
      data: result.rows[0],
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};






// ====================================================================
//           ADD BUSINESS LIST 
// ====================================================================



// ==========  Add Business ========================

const addBusinessType = async (req, res) => {
  try {
    const { business_type } = req.body;

    // validation
    if (!business_type) {
      return res.status(400).json({
        success: false,
        message: "Business type is required",
      });
    }

    // check duplicate
    const existing = await pool.query(
      `
      SELECT *
      FROM business_types
      WHERE LOWER(business_type) = LOWER($1)
    `,
      [business_type],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Business type already exists",
      });
    }

    // insert
    const result = await pool.query(
      `
      INSERT INTO business_types
      (
        business_type
      )
      VALUES ($1)
      RETURNING *
    `,
      [business_type],
    );

    res.status(201).json({
      success: true,
      message: "Business type added successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};



// =========  GET BUSINESS LIST ===================

const getBusinessTypes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM business_types
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


// ========= DELETE BUSINESS ===================

const deleteBusinessType = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(req.params);
    console.log(id)

    const result = await pool.query(
      `
      DELETE FROM business_types
      WHERE id = $1
      RETURNING *
    `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Business type not found",
      });
    }

    res.json({
      success: true,
      message: "Business type deleted successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};





//======== Dashboard States ===================

const getDashboardStats = async (req, res) => {
  try {
    /* ---------------- TOTAL USERS ---------------- */

    const totalUsersQuery = `
      SELECT COUNT(*) AS total_users
      FROM users
    `;

    /* ---------------- MONTHLY REVENUE ---------------- */

    const monthlyRevenueQuery = `
      SELECT COALESCE(SUM(amount), 0) AS monthly_revenue
      FROM payments
      WHERE status = 'paid'
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    `;

    /* ---------------- TOTAL REVIEWS GENERATED ---------------- */

    const totalReviewsQuery = `
      SELECT COALESCE(SUM(total_reviews_generated), 0) AS total_reviews_generated
      FROM businesses
    `;

    /* ---------------- PAID USERS ---------------- */

    const paidUsersQuery = `
      SELECT COUNT(DISTINCT user_id) AS paid_users
      FROM subscriptions
      WHERE status = 'active'
    `;

    /* ---------------- RUN ALL QUERIES ---------------- */

    const [
      totalUsersResult,
      monthlyRevenueResult,
      totalReviewsResult,
      paidUsersResult,
    ] = await Promise.all([
      pool.query(totalUsersQuery),
      pool.query(monthlyRevenueQuery),
      pool.query(totalReviewsQuery),
      pool.query(paidUsersQuery),
    ]);

    /* ---------------- RESPONSE ---------------- */

    return res.status(200).json({
      success: true,

      stats: {
        total_users: Number(
          totalUsersResult.rows[0].total_users
        ),

        monthly_revenue: Number(
          monthlyRevenueResult.rows[0].monthly_revenue
        ),

        total_reviews_generated: Number(
          totalReviewsResult.rows[0].total_reviews_generated
        ),

        paid_subscription_users: Number(
          paidUsersResult.rows[0].paid_users
        ),
      },
    });
  } catch (error) {
    console.log("Dashboard Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};








module.exports = {
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
};