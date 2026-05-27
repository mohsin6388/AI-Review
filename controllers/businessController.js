const pool  = require('../db/index');
const QRCode = require('qrcode');
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');

// Default tags by business type
const DEFAULT_TAGS = {
  restaurant: [
    { label: 'Great Food', emoji: '🍽️' },
    { label: 'Friendly Staff', emoji: '😊' },
    { label: 'Fast Service', emoji: '⚡' },
    { label: 'Clean Place', emoji: '✨' },
    { label: 'Good Value', emoji: '💰' },
    { label: 'Cozy Atmosphere', emoji: '🌟' },
  ],
  shop: [
    { label: 'Great Products', emoji: '🛍️' },
    { label: 'Helpful Staff', emoji: '😊' },
    { label: 'Good Prices', emoji: '💰' },
    { label: 'Quick Billing', emoji: '⚡' },
    { label: 'Clean Store', emoji: '✨' },
    { label: 'Wide Variety', emoji: '🌟' },
  ],
  salon: [
    { label: 'Great Results', emoji: '💇' },
    { label: 'Skilled Staff', emoji: '✂️' },
    { label: 'On Time', emoji: '⏰' },
    { label: 'Clean & Hygienic', emoji: '✨' },
    { label: 'Good Value', emoji: '💰' },
    { label: 'Relaxing Experience', emoji: '🌸' },
  ],
  hotel: [
    { label: 'Clean Rooms', emoji: '🛏️' },
    { label: 'Friendly Staff', emoji: '😊' },
    { label: 'Great Location', emoji: '📍' },
    { label: 'Good Breakfast', emoji: '🍳' },
    { label: 'Fast Check-in', emoji: '⚡' },
    { label: 'Value for Money', emoji: '💰' },
  ],
  default: [
    { label: 'Great Service', emoji: '⭐' },
    { label: 'Friendly Staff', emoji: '😊' },
    { label: 'Clean Place', emoji: '✨' },
    { label: 'Good Value', emoji: '💰' },
    { label: 'Highly Recommend', emoji: '👍' },
    { label: 'Will Visit Again', emoji: '🔄' },
  ],
};





//GET /api/business/review/:id - Get Business Details By ID

const getBusinessById = async (req, res) => {
  const { id } = req.params;
  // const userId = req.user.id;

  try {

    const result = await pool.query(
      `SELECT user_id 
       FROM businesses
       WHERE id = $1`,
      [id],
    );

    const userId = result.rows[0].user_id;

    console.log("USER ID BY BUSINESS ID ===>", userId)


    // =========================
    // SUBSCRIPTION CHECK
    // =========================

    const userResult = await pool.query(
      `
      SELECT status
      FROM subscriptions
      WHERE user_id = $1
      `,
      [userId],
    );

    // console.log(userResult.rows[0]);

    const user = userResult.rows[0];

    console.log("Check user detil of subscription-->", userResult.rows);

    // FREE USER CHECK
    if (user.status === "pending" 
      // || user.subscription_status !== "active"
    ) {
      // COUNT GENERATED REVIEWS
      const reviewCountResult = await pool.query(
        `
       SELECT COALESCE(SUM(total_reviews_generated), 0) AS total_reviews
       FROM businesses
       WHERE user_id = $1
        `,
        [userId],
      );

      const totalReviews = parseInt(reviewCountResult.rows[0].total_reviews);

      // BLOCK USER
      if (totalReviews >= 15) {
        return res.status(403).json({
          success: false,
          upgradeRequired: true,
          message:
            "Free review limit exceeded. Please upgrade your subscription.",
        });
      }
    }

    // =========================
    // BUSINESS FETCH
    // =========================

    const businessResult = await pool.query(
      `
      SELECT *
      FROM businesses
      WHERE id = $1
      `,
      [id],
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    const businesses = businessResult.rows;

    const stats = {
      totalBusinesses: businesses.length,
    };

    const businessIds = businesses.map((biz) => biz.id);

    const tagsResult = await pool.query(
      `
      SELECT *
      FROM tags
      WHERE business_id = ANY($1)
      ORDER BY usage_count DESC
      `,
      [businessIds],
    );

    res.status(200).json({
      businesses,
      tags: tagsResult.rows,
      stats,
    });
  } catch (error) {
    console.error("getBusiness error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
};






// GET /api/business/:id - Get business details with tags
const getBusiness = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM businesses WHERE user_id = $1",
      [id],
    );

    const businesses = result.rows;

    const stats = {
      totalBusinesses: businesses.length,
    };

    res.status(200).json({
      businesses,
      stats,
    });
  } catch (error) {
    console.error("getBusiness error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};  







// POST /api/business - Create new business
const createBusiness = async (req, res) => {
  const { name, type, google_place_id, owner_email, custom_tags, user_id } = req.body;

  if (!name || !type || !google_place_id || !user_id) {
    return res.status(400).json({
      error: "name, type, and google_place_id are required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const google_review_url = `https://search.google.com/local/writereview?placeid=${google_place_id}`;

    const businessResult = await client.query(
      `INSERT INTO businesses (name, type, google_place_id, google_review_url, owner_email, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        name,
        type.toLowerCase(),
        google_place_id,
        google_review_url,
        owner_email,
        user_id,
      ],
    );

    const business = businessResult.rows[0];

    // Insert default tags for this business type
    const tags =
      custom_tags || DEFAULT_TAGS[type.toLowerCase()] || DEFAULT_TAGS.default;
    for (const tag of tags) {
      await client.query(
        `INSERT INTO tags (business_id, label, emoji) VALUES ($1, $2, $3)`,
        [business.id, tag.label, tag.emoji || "⭐"],
      );
    }

    await client.query("COMMIT");

    // Generate QR code
    const reviewPageUrl = `https://ai-reviews-frontend-wxh3.onrender.com/review/${business.id}`;
    // Save url
    // save again in same table
    await client.query(
      `UPDATE businesses
       SET user_review_url = $1
       WHERE id = $2`,
      [reviewPageUrl, business.id],
    );

    const qrCodeDataUrl = await QRCode.toDataURL(reviewPageUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    });

    res.status(201).json({
      business,
      reviewPageUrl,
      qrCode: qrCodeDataUrl,
      message: "Business created successfully!",
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createBusiness error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};



// DELETE Business
const deleteBusinessById = async (req, res) => {
  // DELETE /api/business/:id

    const { id } = req.params;
    console.log(id)

    try {
      // pehle check karo business exist karta hai ya nahi
      const businessCheck = await pool.query(
        `SELECT * FROM businesses WHERE id = $1`,
        [id],
      );

      if (businessCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Business not found",
        });
      }

      // delete business
      await pool.query(`DELETE FROM businesses WHERE id = $1`, [id]);

      res.status(200).json({
        message: "Business deleted successfully",
        message: 'success'
      });
    } catch (error) {
      console.error("deleteBusiness error:", error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  
}; 



// GET /api/business/:id/qr - Regenerate QR code
const getQRCode = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM businesses WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const reviewPageUrl = `http://localhost:3000/review/${id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(reviewPageUrl, {
      width: 500,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });

    res.json({ qrCode: qrCodeDataUrl, reviewPageUrl });
  } catch (error) {
    console.error('getQRCode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};





// GET /api/business/:id/stats - Get business review stats
const getStats = async (req, res) => {
  const { id } = req.params;
  try {
    const businessResult = await pool.query(
      'SELECT * FROM businesses WHERE id = $1', [id]
    );
    if (businessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        AVG(rating)::NUMERIC(3,2) as avg_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_reviews,
        COUNT(CASE WHEN redirect_clicked = true THEN 1 END) as redirected_to_google,
        COUNT(CASE WHEN review_copied = true THEN 1 END) as reviews_copied
      FROM review_sessions 
      WHERE business_id = $1
    `, [id]);

    const ratingDistResult = await pool.query(`
      SELECT rating, COUNT(*) as count
      FROM review_sessions
      WHERE business_id = $1
      GROUP BY rating ORDER BY rating DESC
    `, [id]);

    const topTagsResult = await pool.query(`
      SELECT label, emoji, usage_count
      FROM tags WHERE business_id = $1
      ORDER BY usage_count DESC LIMIT 5
    `, [id]);

    res.json({
      business: businessResult.rows[0],
      stats: statsResult.rows[0],
      ratingDistribution: ratingDistResult.rows,
      topTags: topTagsResult.rows,
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




;// GET /api/business/business-type -  GET BUSINESSES TYPE
const handleGetBusinessType = async (req, res) => {

  console.log("Yha tak request aa rhi hai...............")
  try {
    const query = `
      SELECT *
      FROM business_types
      ORDER BY business_type ASC
    `;

    const result = await pool.query(query);

    return res.status(200).json({
      success: true,
      message: "Business categories fetched successfully",
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get Business Types Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}





const hanleGooglePlaces = async (req, res) => {
  try {
    const input = req.query.input;

    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Input is required",
      });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json",
      {
        params: {
          input,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    );

    res.json({
      success: true,
      predictions: response.data.predictions,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
}


module.exports = {
  getBusiness,
  createBusiness,
  getQRCode,
  getStats,
  getBusinessById,
  deleteBusinessById,
  hanleGooglePlaces,
  handleGetBusinessType,
};
