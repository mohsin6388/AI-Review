require("dotenv").config();
const pool = require("../db/index");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});




// Create Payment Order
const createOrder = async (req, res) => {
  try {
    const { plan_id, user_id } = req.body;

    // ================= GET PLAN =================

    const planResult = await pool.query(
      `
      SELECT *
      FROM subscription_plans
      WHERE name = $1
      `,
      [plan_id],
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const plan = planResult.rows[0];

    // ================= CREATE SUBSCRIPTION =================

    const subscriptionResult = await pool.query(
      `
      INSERT INTO subscriptions
      (
        user_id,
        plan_id,
        status
      )
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [user_id, plan.id, "pending"],
    );

    const subscription = subscriptionResult.rows[0];

    // ================= CREATE ORDER =================

    console.log("Creating order with amount", plan.price);

    const options = {
      amount: plan.price * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // ================= SAVE PAYMENT =================

    await pool.query(
      `
      INSERT INTO payments
      (
        user_id,
        subscription_id,
        razorpay_order_id,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [user_id, subscription.id, order.id, plan.price, "pending"],
    );

    // ================= RESPONSE =================

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};





// Verify Payment Order
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // ================= VERIFY SIGNATURE =================

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

      console.log("Generated Signature", generated_signature);
      console.log("Razorpay Signature", razorpay_signature);

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // ================= FETCH PAYMENT DETAILS =================

    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

    // ================= UPDATE PAYMENT =================

    const paymentResult = await pool.query(
      `
      UPDATE payments
      SET
        razorpay_payment_id = $1,
        razorpay_signature = $2,
        payment_method = $3,
        status = $4,
        paid_at = NOW()
      WHERE razorpay_order_id = $5
      RETURNING *
      `,
      [
        razorpay_payment_id,
        razorpay_signature,
        paymentDetails.method,
        "success",
        razorpay_order_id,
      ],
    );

    const payment = paymentResult.rows[0];

    // ================= GET SUBSCRIPTION =================

    const subscriptionResult = await pool.query(
      `
        SELECT
          s.*,
          sp.duration_days
        FROM subscriptions s
        JOIN subscription_plans sp
        ON sp.id = s.plan_id
        WHERE s.id = $1
        `,
      [payment.subscription_id],
    );

    const subscription = subscriptionResult.rows[0];

    // ================= ACTIVATE SUBSCRIPTION =================

    await pool.query(
      `
      UPDATE subscriptions
      SET
        status = 'active',
        start_date = NOW(),
        end_date =
          NOW() +
          ($1 || ' days')::interval
      WHERE id = $2
      `,
      [subscription.duration_days, subscription.id],
    );

    return res.status(200).json({
      success: true,
      paymentMethod: paymentDetails.method,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};





















//======= Razorpay payment Create ================
//=================================================
// const createOrder = async (req, res) => {
//   console.log("Payment Creating Start...............");
//   try {
//     const { amount, planName, user_id } = req.body;

//     const options = {
//       amount: amount * 100,
//       currency: "INR",
//       receipt: `receipt_${Date.now()}`,
//     };

//     const order = await razorpay.orders.create(options);

//     await pool.query(
//       `
//       INSERT INTO payments
//       (
//         user_id,
//         razorpay_order_id,
//         amount,
//         plan_name,
//         status
//       )
//       VALUES ($1, $2, $3, $4, $5)
//       `,
//       [
//         //req.user.id,
//         user_id,
//         order.id,
//         amount,
//         planName,
//         "pending",
//       ],
//     );

//     res.status(200).json(order);
//   } catch (error) {
//     console.log(error);

//     res.status(500).json({
//       error: "Order creation failed",
//     });
//   }
// };

//========================================================

// const crypto = require("crypto");

// const Razorpay = require("razorpay");

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_SECRET,
// });

// const verifyPayment = async (req, res) => {
//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
//       req.body;

//     // ---------------- VERIFY SIGNATURE ----------------

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_SECRET)
//       .update(razorpay_order_id + "|" + razorpay_payment_id)
//       .digest("hex");

//     if (generated_signature !== razorpay_signature) {
//       return res.status(400).json({
//         success: false,
//         error: "Invalid signature",
//       });
//     }

//     // ---------------- FETCH PAYMENT DETAILS ----------------

//     const payment = await razorpay.payments.fetch(razorpay_payment_id);

//     console.log("Payment Details", payment);

//     // ---------------- PAYMENT METHOD ----------------

//     const paymentMethod = payment.method;

//     // Examples:
//     // upi
//     // card
//     // netbanking
//     // wallet

//     // ---------------- UPDATE PAYMENT ----------------

//     await pool.query(
//       `
//       UPDATE payments
//       SET
//         razorpay_payment_id = $1,
//         razorpay_signature = $2,
//         payment_method = $3,
//         status = $4
//       WHERE razorpay_order_id = $5
//       `,
//       [
//         razorpay_payment_id,
//         razorpay_signature,
//         paymentMethod,
//         "success",
//         razorpay_order_id,
//       ],
//     );

//     // ---------------- UPDATE USER ----------------

//     await pool.query(
//       `
//       UPDATE users
//       SET
//         plan_type = $1,
//         subscription_status = $2
//       WHERE id = (
//         SELECT user_id
//         FROM payments
//         WHERE razorpay_order_id = $3
//       )
//       `,
//       ["pro", "active", razorpay_order_id],
//     );

//     // ---------------- RESPONSE ----------------

//     res.status(200).json({
//       success: true,
//       paymentMethod,
//     });
//   } catch (error) {
//     console.log(error);

//     res.status(500).json({
//       success: false,
//       error: "Verification failed",
//     });
//   }
// };



module.exports = {
  createOrder,
  verifyPayment,
};
