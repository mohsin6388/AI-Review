// services/autoReplyOrchestrator.js
const { pool } = require("../db/index.js"); // apna DB path
const {
  getUnrepliedReviews,
  starRatingToNumber,
} = require("./reviewFetchService");
const { generateReply } = require("./groqService");
const { postReviewReply } = require("./replyPostService");

const MAX_PER_RUN = parseInt(process.env.MAX_REVIEWS_PER_RUN || "10");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const processOneReview = async (review, account, location) => {
  const reviewId = review.name;
  const reviewerName = review.reviewer?.displayName || "Valued Customer";
  const reviewText = review.comment || "";
  const starRating = starRatingToNumber(review.starRating);
  const businessName =
    account.business_name || location.location_name || "Our Business";

  // DB mein pending record daalo (duplicate se bachne ke liye)
  await pool.query(
    `INSERT INTO review_replies 
      (review_id, location_id, account_id, reviewer_name, star_rating, review_text, replied_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (review_id) DO NOTHING`,
    [
      reviewId,
      location.location_id,
      account.id,
      reviewerName,
      review.starRating,
      reviewText,
    ],
  );

  // Groq se reply generate karo
  let generatedReply;
  try {
    generatedReply = await generateReply({
      reviewText,
      reviewerName,
      starRating,
      businessName,
    });
  } catch (err) {
    await pool.query(
      `UPDATE review_replies 
       SET replied_status='failed', failure_reason=$1, retry_count=retry_count+1, updated_at=NOW()
       WHERE review_id=$2`,
      [err.message, reviewId],
    );
    console.error(`[Orchestrator] Groq failed for ${reviewId}: ${err.message}`);
    return "failed";
  }

  // Google pe reply post karo
  try {
    await postReviewReply(account, reviewId, generatedReply);
  } catch (err) {
    await pool.query(
      `UPDATE review_replies 
       SET replied_status='failed', generated_reply=$1, failure_reason=$2, retry_count=retry_count+1, updated_at=NOW()
       WHERE review_id=$3`,
      [generatedReply, err.message, reviewId],
    );
    console.error(
      `[Orchestrator] Google post failed for ${reviewId}: ${err.message}`,
    );
    if (
      err.message.startsWith("AUTH_EXPIRED") ||
      err.message.startsWith("PERMISSION_DENIED")
    ) {
      throw err; // fatal — is account ko skip karo
    }
    return "failed";
  }

  // Success — DB update karo
  await pool.query(
    `UPDATE review_replies 
     SET replied_status='replied', generated_reply=$1, replied_at=NOW(), updated_at=NOW()
     WHERE review_id=$2`,
    [generatedReply, reviewId],
  );

  console.log(`[Orchestrator] ✅ Replied to ${reviewId} (${starRating}★)`);
  return "replied";
};

const runAutoReply = async () => {
  console.log("\n[AutoReply] ===== Run started =====");

  // Tumhare google_accounts table se active accounts fetch karo
  const { rows: accounts } = await pool.query(
    `SELECT ga.*, bl.id as loc_db_id, bl.location_id, bl.location_name
     FROM google_accounts ga
     JOIN business_locations bl ON bl.account_id = ga.id
     WHERE ga.is_active = true AND bl.is_active = true`,
  );

  if (!accounts.length) {
    console.log("[AutoReply] No active accounts found.");
    return;
  }

  // accounts ko group karo by account
  const accountMap = {};
  for (const row of accounts) {
    if (!accountMap[row.id]) {
      accountMap[row.id] = {
        id: row.id,
        google_account_id: row.google_account_id,
        business_name: row.business_name,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        token_expiry: row.token_expiry,
        locations: [],
      };
    }
    accountMap[row.id].locations.push({
      location_id: row.location_id,
      location_name: row.location_name,
    });
  }

  let totalReplied = 0,
    totalFailed = 0;

  for (const account of Object.values(accountMap)) {
    for (const location of account.locations) {
      let unreplied;
      try {
        unreplied = await getUnrepliedReviews(account, location);
      } catch (err) {
        console.error(
          `[AutoReply] Fetch failed for ${location.location_id}: ${err.message}`,
        );
        continue;
      }

      const toProcess = unreplied.slice(0, MAX_PER_RUN);
      console.log(
        `[AutoReply] ${toProcess.length} reviews to process for ${location.location_id}`,
      );

      for (const review of toProcess) {
        try {
          const result = await processOneReview(review, account, location);
          if (result === "replied") totalReplied++;
          else totalFailed++;
        } catch (fatalErr) {
          console.error(
            `[AutoReply] Fatal error, skipping account: ${fatalErr.message}`,
          );
          break;
        }
        await sleep(1500); // rate limit ke liye
      }
      await sleep(2000);
    }
  }

  console.log(
    `[AutoReply] ===== Done — Replied: ${totalReplied}, Failed: ${totalFailed} =====\n`,
  );
  return { replied: totalReplied, failed: totalFailed };
};

module.exports = { runAutoReply };
