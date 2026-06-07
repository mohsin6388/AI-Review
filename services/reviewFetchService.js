// services/reviewFetchService.js
const axios = require("axios");
const { pool } = require("../db/index"); // apna DB path
const { getValidAccessToken } = require("./tokenService");

const GBP_BASE_URL = "https://mybusiness.googleapis.com/v4";

// Google reviews fetch karo (pagination handle karta hai)
const fetchAllReviews = async (locationId, accessToken) => {
  const reviews = [];
  let pageToken = null;

  do {
    const params = { pageSize: 50 };
    if (pageToken) params.pageToken = pageToken;

    const response = await axios.get(`${GBP_BASE_URL}/${locationId}/reviews`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
    });

    if (response.data.reviews) {
      reviews.push(...response.data.reviews);
    }
    pageToken = response.data.nextPageToken || null;
  } while (pageToken);

  return reviews;
};


// Sirf woh reviews lo jinke reply nahi hue
const getUnrepliedReviews = async (account, location) => {
  const accessToken = await getValidAccessToken(account);

  let allReviews;
  try {
    allReviews = await fetchAllReviews(location.location_id, accessToken);
  } catch (error) {
    const status = error.response?.status;
    if (status === 401) throw new Error(`AUTH_EXPIRED:${account.id}`);
    if (status === 429) throw new Error(`RATE_LIMITED`);
    throw new Error(`Google fetch error (${status}): ${error.message}`);
  }

  // Step 1: Google side pe reply nahi hai
  const noGoogleReply = allReviews.filter(
    (r) => !r.reviewReply || !r.reviewReply.comment,
  );

  // Step 2: Humari DB mein bhi already process nahi hua
  if (noGoogleReply.length === 0) return [];

  const reviewIds = noGoogleReply.map((r) => r.name);
  const placeholders = reviewIds.map((_, i) => `$${i + 1}`).join(", ");

  const { rows: alreadyDone } = await pool.query(
    `SELECT review_id FROM review_replies 
     WHERE review_id IN (${placeholders}) 
     AND replied_status IN ('replied', 'pending')`,
    reviewIds,
  );

  const doneSet = new Set(alreadyDone.map((r) => r.review_id));

  return noGoogleReply.filter((r) => !doneSet.has(r.name));
};

const starRatingToNumber = (ratingStr) => {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[ratingStr?.toUpperCase()] || 0;
};

module.exports = { getUnrepliedReviews, starRatingToNumber };
