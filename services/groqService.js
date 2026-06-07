// services/groqService.js
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a professional customer support assistant. Generate natural, human-like Google review replies. Keep replies between 30 and 80 words. Never argue with customers. Be polite, professional, and friendly. For positive reviews, thank the customer warmly. For negative reviews, apologize professionally and encourage further contact. Return only the reply text.`;

const getToneInstruction = (starRating) => {
  if (starRating === 5)
    return "5-star review: Thank warmly, appreciate their support genuinely.";
  if (starRating === 4)
    return "4-star review: Thank for feedback, acknowledge suggestions, invite them back.";
  return "Low rating: Apologize professionally, acknowledge concerns, encourage direct contact to resolve.";
};

const generateReply = async ({
  reviewText,
  reviewerName,
  starRating,
  businessName,
}) => {
  const userPrompt = `
Business Name: ${businessName || "Our Business"}
Reviewer Name: ${reviewerName || "Valued Customer"}
Star Rating: ${starRating} out of 5
Review Text: ${reviewText || "(No written review — rating only)"}

${getToneInstruction(starRating)}

Rules:
- 30 to 80 words only
- Unique and personal, not generic
- No markdown, plain text only
- Return only the reply, nothing else
`.trim();

  let attempt = 0;
  while (attempt < 3) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 200,
      });

      const reply = completion.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error("Empty response from Groq");
      return reply;
    } catch (error) {
      attempt++;
      console.error(`[Groq] Attempt ${attempt} failed: ${error.message}`);
      if (attempt >= 3)
        throw new Error(`Groq failed after 3 attempts: ${error.message}`);
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
};

module.exports = { generateReply };
