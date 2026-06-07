// services/replyPostService.js
const axios = require("axios");
const { getValidAccessToken } = require("./tokenService");

const GBP_BASE_URL = "https://mybusiness.googleapis.com/v4";

const postReviewReply = async (account, reviewName, replyText) => {
  const accessToken = await getValidAccessToken(account);

  try {
    const response = await axios.put(
      `${GBP_BASE_URL}/${reviewName}/reply`,
      { comment: replyText },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    console.log(`[Reply] Posted successfully: ${reviewName}`);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (status === 401) throw new Error(`AUTH_EXPIRED:${account.id}`);
    if (status === 403) throw new Error(`PERMISSION_DENIED: ${reviewName}`);
    if (status === 429) throw new Error(`RATE_LIMITED`);
    if (status === 404) throw new Error(`REVIEW_NOT_FOUND: ${reviewName}`);
    throw new Error(`Google reply error (${status}): ${error.message}`);
  }
};

module.exports = { postReviewReply };
