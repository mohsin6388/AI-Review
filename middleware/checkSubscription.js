const requireSubscription = async (req, res, next) => {
  const userId = req.user.id;

  const result = await pool.query(
    `
      SELECT *
      FROM subscriptions
      WHERE user_id = $1
      AND status='active'
      AND (
         end_date IS NULL
         OR end_date > NOW()
      )
   `,
    [userId],
  );

  if (result.rows.length === 0) {
    return res.status(403).json({
      error: "Subscription required",
    });
  }

  next();
};

module.exports = {
  requireSubscription
};
