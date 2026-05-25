require("dotenv").config();
const pool = require("../db/index");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

//======= Razorpay payment Create ================
//=================================================
const createOrder = async (req, res) => {
  console.log("Payment Creating Start...............");
  try {
    const { amount, planName, user_id } = req.body;

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    await pool.query(
      `
      INSERT INTO payments
      (
        user_id,
        razorpay_order_id,
        amount,
        plan_name,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        //req.user.id,
        user_id,
        order.id,
        amount,
        planName,
        "pending",
      ],
    );

    res.status(200).json(order);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Order creation failed",
    });
  }
};

//========================================================

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        error: "Invalid signature",
      });
    }

    await pool.query(
      `
  UPDATE payments
  SET
    razorpay_payment_id = $1,
    razorpay_signature = $2,
    status = $3
  WHERE razorpay_order_id = $4
  `,
      [razorpay_payment_id, razorpay_signature, "success", razorpay_order_id],
    );

    await pool.query(
      `
  UPDATE users
  SET
    plan_type = $1,
    subscription_status = $2
  WHERE id = (
    SELECT user_id
    FROM payments
    WHERE razorpay_order_id = $3
  )
  `,
      ["pro", "active", razorpay_order_id],
    );

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Verification failed",
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
};
