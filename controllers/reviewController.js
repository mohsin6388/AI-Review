require("dotenv").config();
const pool = require("../db/index");
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});





const generateAITags = async (businessName, businessType) => {
  console.log("BUSINESS NAME ===>", businessName);
  console.log("BUSINESS TYPE ===>", businessType);
  try {
    const prompt = `
You are generating customer feedback tags for a business.

Business Name: ${businessName}
Business Type: ${businessType}

Generate EXACTLY 6 short customer experience tags.

Rules:
- Tags should sound like real customer feedback
- Keep tags short (2-3 words)
- Human readable
- Service experience focused
- Different from each other
- No generic boring tags
- Avoid:
  - Excellent Service
  - Amazing Experience
  - Highly Recommended

Examples:
- Quick Response
- Friendly Staff
- Clean Environment
- On-Time Delivery
- Easy To Work With

Return ONLY valid JSON like this:

{
  "tags": [
    {
      "label": "Quick Response",
      "emoji": "⚡"
    }
  ]
}
`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 1,
      response_format: {
        type: "json_object",
      },
    });

    const content = completion.choices[0].message.content;

    const parsedData = JSON.parse(content);

    return parsedData.tags || [];
  } catch (error) {
    console.log("AI TAG GENERATION ERROR:", error);

    return [];
  }
};


const generateReview = async (req, res) => {
  const { business_id, rating, selected_tags } = req.body;

  if (!business_id || !rating || !selected_tags?.length) {
    return res.status(400).json({
      error: "business_id, rating, and selected_tags are required",
    });
  }

  if (rating < 2) {
    return res.status(400).json({
      error: "AI review generation only for 3+ star ratings",
    });
  }

  try {
    // =========================
    // FETCH BUSINESS
    // =========================

    const businessResult = await pool.query(
      "SELECT * FROM businesses WHERE id = $1",
      [business_id],
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    const business = businessResult.rows[0];

    const starEmoji = "⭐".repeat(rating);
    const tagsText = selected_tags.join(", ");

    // =========================
    // AI PROMPT
    // =========================

    const prompt = `
You are helping customers write authentic Google reviews.

Business Name: ${business.name}
Business Type: ${business.type}
Rating: ${rating}/5 ${starEmoji}
Highlights: ${tagsText}

Generate EXACTLY 3 different Google reviews.

Rules:
- Human sounding
- Short and natural
- 2-3 sentences only
- Every review should feel unique
- Different sentence style every time
- Avoid robotic tone
- Avoid repeating same words
- Do NOT use:
  - "I recently visited"
  - "Highly recommended"
  - "Amazing experience"
- Keep reviews readable and realistic

Return ONLY valid JSON like this:

[
  {
    "review": "text here"
  },
  {
    "review": "text here"
  },
  {
    "review": "text here"
  }
]
`;

    // =========================
    // GENERATE REVIEWS
    // =========================

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 1,
      response_format: {
        type: "json_object",
      },
    });

    const responseContent = completion.choices[0].message.content;

    let parsedReviews;

    try {
      parsedReviews = JSON.parse(responseContent);
    } catch (err) {
      console.log("JSON Parse Error:", err);

      return res.status(500).json({
        error: "Failed to parse AI response",
      });
    }

    // =========================
    // HANDLE ARRAY
    // =========================

    const reviewsArray = Array.isArray(parsedReviews)
      ? parsedReviews
      : parsedReviews.reviews || [];

    if (reviewsArray.length === 0) {
      return res.status(500).json({
        error: "No reviews generated",
      });
    }

    // =========================
    // SAVE SESSION
    // =========================

    const generatedReviewsText = reviewsArray.map((item) => item.review);

    const sessionResult = await pool.query(
      `
      INSERT INTO review_sessions 
      (
        business_id,
        rating,
        selected_tags,
        generated_review
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [
        business_id,
        rating,
        selected_tags,
        JSON.stringify(generatedReviewsText),
      ],
    );

    // =========================
    // UPDATE TAGS
    // =========================

    if (selected_tags.length > 0) {
      await pool.query(
        `
        UPDATE tags
        SET usage_count = usage_count + 1
        WHERE business_id = $1
        AND label = ANY($2)
        `,
        [business_id, selected_tags],
      );
    }

    // =========================
    // UPDATE BUSINESS STATS
    // =========================

    await pool.query(
      `
      UPDATE businesses
      SET total_reviews_generated =
      total_reviews_generated + 1,
      updated_at = NOW()
      WHERE id = $1
      `,
      [business_id],
    );

    // =========================
    // GET USER ID
    // =========================

    const userByBusiness = await pool.query(
      `
      SELECT user_id
      FROM businesses
      WHERE id = $1
      `,
      [business_id],
    );

    const user_id = userByBusiness.rows[0].user_id;

    // =========================
    // SAVE ALL REVIEWS
    // =========================

    // for (const item of reviewsArray) {
    //   await pool.query(
    //     `
    //     INSERT INTO reviews (
    //       user_id,
    //       business_id,
    //       review_text,
    //       star_rating
    //     )
    //     VALUES ($1, $2, $3, $4)
    //     `,
    //     [user_id, business_id, item.review, rating],
    //   );
    // }

    // =========================
    // RESPONSE
    // =========================

    res.json({
      reviews: reviewsArray,
      session_id: sessionResult.rows[0].id,
      google_review_url: business.google_review_url,
    });
  } catch (error) {
    console.error("generateReview error:", error);

    res.status(500).json({
      error: "Failed to generate review. Please try again.",
    });
  }
};



const trackCopied = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "UPDATE review_sessions SET review_copied = true WHERE id = $1",
      [id],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("trackCopied error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/review/session/:id/redirected - Track Google redirect
const trackRedirected = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "UPDATE review_sessions SET redirect_clicked = true WHERE id = $1",
      [id],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("trackRedirected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



// POST /api/review/feedback - Save negative feedback (1-3 stars)
const saveFeedback = async (req, res) => {
  const { business_id, rating, feedback_text } = req.body;

  if (!business_id || !rating) {
    return res.status(400).json({
      error: "business_id and rating required",
    });
  }

  try {
    // STEP 1 → GET USER ID
    const businessResult = await pool.query(
      `
      SELECT user_id
      FROM businesses
      WHERE id = $1
      `,
      [business_id],
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    const user_id = businessResult.rows[0].user_id;

    // STEP 2 → SAVE REVIEW
    await pool.query(
      `
      INSERT INTO reviews (
        business_id,
        user_id,
        star_rating,
        review_text
      )
      VALUES ($1, $2, $3, $4)
      `,
      [
        business_id,
        user_id,
        rating,
        feedback_text || "Private feedback - low rating",
      ],
    );

    // STEP 3 → INCREMENT TOTAL REVIEWS
    await pool.query(
      `
      UPDATE businesses
      SET total_reviews_generated =
        total_reviews_generated + 1
      WHERE id = $1
      `,
      [business_id],
    );

    res.json({
      success: true,
      message: "Feedback saved successfully",
    });
  } catch (error) {
    console.error("saveFeedback error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
};


const getReviewsByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;

    console.log("ha yeh chl rha hai ---> ",businessId);

    // Step 1: Business ka owner/user nikalo
    const businessResult = await pool.query(
      `
      SELECT user_id
      FROM businesses
      WHERE id = $1
      `,
      [businessId],
    );

    // Agar business exist nahi karta
    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    const userId = businessResult.rows[0].user_id;

    // Step 2: User ka plan check karo
    const userResult = await pool.query(
      `
      SELECT status
      FROM subscriptions
      WHERE user_id = $1
      `,
      [userId],
    );

    // Agar user nahi mila
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userPlan = userResult.rows[0].plan_type;

    // Step 3: Agar free plan hai to reviews mat bhejo
    if (userPlan === "pending") {
      return res.status(403).json({
        error: "Upgrade to Pro to access reviews",
      });
    }

    // Step 4: Agar pro hai to reviews bhejo
    const result = await pool.query(
      `
      SELECT *
      FROM reviews
      WHERE business_id = $1
      ORDER BY created_at DESC
      `,
      [businessId],
    );

    res.json({
      reviews: result.rows,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server error",
    });
  }
};


//======================================================
//          AUTO REPLY TO GOOGLE REVIEWS
//======================================================

// const { triggerManualRun } = require("../jobs/autoReplyJob");

// const manualRun = async (req, res) => {
//   try {
//     const result = await triggerManualRun();
//     res.json({ success: true, stats: result });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// const getStats = async (req, res) => {
//   try {
//     const { rows } = await pool.query(
//       `SELECT replied_status, COUNT(*) as count 
//        FROM review_replies 
//        GROUP BY replied_status`
//     );
//     res.json({ success: true, stats: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// const getReplies = async (req, res) => {
//   try {
//     const { status, page = 1, limit = 20 } = req.query;
//     const offset = (page - 1) * limit;
//     const where = status ? `WHERE replied_status = '${status}'` : "";

//     const { rows } = await pool.query(
//       `SELECT * FROM review_replies ${where} 
//        ORDER BY created_at DESC 
//        LIMIT $1 OFFSET $2`,
//       [limit, offset]
//     );
//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };


module.exports = {
  generateReview,
  trackCopied,
  trackRedirected,
  saveFeedback,
  getReviewsByBusiness,
  generateAITags,
};
