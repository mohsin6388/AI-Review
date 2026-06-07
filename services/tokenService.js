// services/tokenService.js
const axios = require("axios");
const { pool } = require("../db/index.js"); // <-- yahan apna DB connection import karo

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const getValidAccessToken = async (account) => {
  const now = Date.now();
  const expiryTime = account.expiry_date
    ? new Date(account.expiry_date).getTime()
    : 0;

  // Token abhi valid hai
  if (expiryTime && now < expiryTime - 5 * 60 * 1000) {
    return account.access_token;
  }

  console.log(`[Token] Refreshing token for account ${account.id}...`);

  try {
    const response = await axios.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const { access_token, expires_in } = response.data;
    const newExpiry = Date.now() + expires_in * 1000;

    // DB mein update karo
    await pool.query(
      `UPDATE google_accounts 
       SET access_token = $1, expiry_date = $2 
       WHERE id = $3`,
      [access_token, newExpiry, account.id],
    );

    console.log(`[Token] Refreshed successfully for account ${account.id}`);
    return access_token;
  } catch (error) {
    const errData = error.response?.data;
    // Agar refresh token revoke ho gaya ho
    if (errData?.error === "invalid_grant") {
      await pool.query(
        `UPDATE google_accounts SET is_active = false WHERE id = $1`,
        [account.id],
      );
      console.error(
        `[Token] Account ${account.id} deactivated - refresh token revoked`,
      );
    }
    throw new Error(
      `Token refresh failed: ${errData?.error_description || error.message}`,
    );
  }
};

module.exports = { getValidAccessToken };
