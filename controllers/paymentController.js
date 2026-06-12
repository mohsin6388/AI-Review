require("dotenv").config();
const pool = require("../db/index");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});




const checkUserPaymentStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `
  SELECT
    s.id AS subscription_id,
    s.status AS subscription_status,
    s.start_date,
    s.end_date,

    p.id AS payment_id,
    p.status AS payment_status,
    p.amount,
    p.paid_at,
    p.plan_id,

    sp.name AS plan_name

  FROM subscriptions s

  LEFT JOIN payments p
    ON p.user_id = s.user_id
   AND p.plan_id = s.plan_id
   AND p.status = 'success'

  LEFT JOIN subscription_plans sp
    ON sp.id = p.plan_id

  WHERE s.user_id = $1

  ORDER BY p.paid_at DESC NULLS LAST
  LIMIT 1
  `,
      [userId],
    ); 

    // const result = await pool.query(
    //   `
    //   SELECT
    //     s.id AS subscription_id,
    //     s.status AS subscription_status,
    //     s.start_date,
    //     s.end_date,

    //     p.id AS payment_id,
    //     p.status AS payment_status,
    //     p.amount,
    //     p.paid_at,
    //     p.plan_id
    //   FROM subscriptions s
    //   LEFT JOIN payments p
    //     ON p.user_id = s.user_id
    //    AND p.plan_id = s.plan_id
    //    AND p.status = 'success'
    //   WHERE s.user_id = $1
    //   ORDER BY p.paid_at DESC NULLS LAST
    //   LIMIT 1
    //   `,
    //   [userId],
    // );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        isPaid: false,
        isSubscriptionActive: false,
        message: "No subscription found",
      });
    }

    console.log(result.rows)

    const data = result.rows[0];

    const isSubscriptionActive =
      data.subscription_status === "active" &&
      data.end_date &&
      new Date(data.end_date) > new Date();

    return res.status(200).json({
      success: true,
      isPaid: !!data.payment_id,
      isSubscriptionActive,
      data,
    });
  } catch (error) {
    console.error("Error checking payment status:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};






// const checkUserPaymentStatus = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     console.log("Checking payment status for user ======>", userId);

//     const result = await pool.query(
//       `
//       SELECT
//         p.id AS payment_id,
//         p.status AS payment_status,
//         p.paid_at,
//         s.id AS subscription_id,
//         s.status AS subscription_status,
//         s.start_date,
//         s.end_date
//       FROM subscriptions s
//       LEFT JOIN payments p
//         ON p.subscription_id = s.id
//       WHERE s.user_id = $1
//       AND p.status = 'success'
//       ORDER BY p.paid_at DESC
//       LIMIT 1
//       `,
//       [userId],
//     );

//     if (result.rows.length === 0) {
//       return res.status(200).json({
//         success: true,
//         isPaid: false,
//         message: "No successful payment found",
//       });
//     }

//     const payment = result.rows[0];

//     const isSubscriptionActive =
//       payment.subscription_status === "active" &&
//       new Date(payment.end_date) > new Date();

//       console.log("Payment found:======>", payment);
//       console.log("Is subscription active?====>", isSubscriptionActive);

//     return res.status(200).json({
//       success: true,
//       isPaid: true,
//       isSubscriptionActive,
//       payment,
//     });
//   } catch (error) {
//     console.error(error);

//     return res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// };





// Create Payment Order









const createOrder = async (req, res) => {
  try {
    const { plan_name, user_id } = req.body;

    // ================= GET PLAN =================

    const planResult = await pool.query(
      `
      SELECT *
      FROM subscription_plans
      WHERE name = $1
      `,
      [plan_name],
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const plan = planResult.rows[0];

    // ================= CREATE SUBSCRIPTION =================

    // const subscriptionResult = await pool.query(
    //   `
    //   INSERT INTO subscriptions
    //   (
    //     user_id,
    //     plan_id,
    //     status
    //   )
    //   VALUES ($1, $2, $3)
    //   RETURNING *
    //   `,
    //   [user_id, plan.id, "pending"],
    // );

    // const subscription = subscriptionResult.rows[0];

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
        plan_id,
        razorpay_order_id,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [user_id, plan.id, order.id, plan.price, "pending"],
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

    // console.log("Generated Signature", generated_signature);
    // console.log("Razorpay Signature", razorpay_signature);

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

    // ================= GET PLAN =================

    const planResult = await pool.query(
      `
         SELECT *
         FROM subscription_plans
         WHERE id = $1
         `,
      [payment.plan_id],
    );

    const plan = planResult.rows[0];

    // ================= GET SUBSCRIPTION =================

    // const subscriptionResult = await pool.query(
    //   `
    //     SELECT
    //       s.*,
    //       sp.duration_days
    //     FROM subscriptions s
    //     JOIN subscription_plans sp
    //     ON sp.id = s.plan_id
    //     WHERE s.id = $1
    //     `,
    //   [payment.subscription_id],
    // );

    // const subscription = subscriptionResult.rows[0];

    // ================= ACTIVATE SUBSCRIPTION =================

    // await pool.query(
    //   `
    //   UPDATE subscriptions
    //   SET
    //     status = 'active',
    //     start_date = NOW(),
    //     end_date =
    //       NOW() +
    //       ($1 || ' days')::interval
    //   WHERE id = $2
    //   `,
    //   [subscription.duration_days, subscription.id],
    // );



    // ================= CANCEL OLD ACTIVE SUBSCRIPTIONS =================

    await pool.query(
      `
  UPDATE subscriptions
  SET status = 'cancelled'
  WHERE user_id = $1
  AND status = 'active'
  `,
      [payment.user_id],
    );

    // ================= CREATE NEW SUBSCRIPTION =================

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
  VALUES
  (
    $1,
    $2,
    'active',
    NOW(),
    NOW() + ($3 || ' days')::interval
  )
  `,
      [payment.user_id, payment.plan_id, plan.duration_days],
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





module.exports = {
  createOrder,
  verifyPayment,
  checkUserPaymentStatus,
};
