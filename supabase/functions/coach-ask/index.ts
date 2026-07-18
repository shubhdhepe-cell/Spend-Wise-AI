// Supabase Edge Function: coach-ask
// The AI here ONLY explains/narrates statistics that were already calculated
// by application code (in the frontend, from real Supabase data). It never
// sees raw transactions and never invents figures — it can only reference
// numbers explicitly provided to it in the "stats" object below.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { question, stats } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'question' field." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    if (!stats || typeof stats !== "object") {
      return new Response(
        JSON.stringify({ error: "Missing 'stats' field." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a personal spending coach inside an expense-tracking app called SpendWise AI. You help users understand their OWN spending habits.

STRICT RULES:
- Only reference numbers explicitly given to you in the "USER'S REAL SPENDING STATS" section below. Never estimate, invent, or infer any figure not given.
- If the stats don't contain enough information to answer precisely, say so honestly rather than guessing.
- Do NOT give investment advice, tax advice, loan advice, or any professional financial advice. Stay strictly limited to the user's own spending/expense behavior.
- Use Indian Rupees (₹) when referencing amounts.
- Be concise, warm, and practical — like a helpful friend, not a lecture.
- Give 1-2 concrete, practical recommendations tied directly to the stats given.

USER'S REAL SPENDING STATS (this month vs last month, by category):
${JSON.stringify(stats, null, 2)}

USER'S QUESTION:
"${question}"

Respond with ONLY valid JSON, nothing else, in exactly this shape:
{"answer": string, "recommendations": [string, string]}

"answer" should directly address the question using only the stats given.
"recommendations" should be 1-2 short, practical, actionable suggestions (can be an array with just 1 item if that's all that fits naturally).`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return new Response(
        JSON.stringify({ error: "The coach couldn't process that right now. Please try again." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const data = await geminiResponse.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse Gemini's JSON:", rawText);
      // Fallback: still show something useful rather than a hard failure
      parsed = { answer: rawText || "I couldn't generate a clear answer. Try rephrasing your question.", recommendations: [] };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
