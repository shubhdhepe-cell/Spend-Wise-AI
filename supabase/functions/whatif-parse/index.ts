// Supabase Edge Function: whatif-parse
// Takes a natural language "what if" question and extracts structured intent.
// Does NOT do any math — that happens in the frontend/app code, using real
// database numbers. This function's only job is understanding the sentence.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_CATEGORIES = ["Food","Transport","Shopping","Education","Bills","Entertainment","Health","Other"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'question' field in request body." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a "what-if" question parser for a personal expense app. Extract the user's intent from this question: "${question}"

Return ONLY valid JSON, nothing else, no markdown, in exactly this shape:
{"category": string, "reduction_type": "percentage" | "amount", "reduction_value": number}

Rules:
- "category" must be exactly one of: ${VALID_CATEGORIES.join(", ")}
- If the question mentions a percentage (e.g. "reduce by 20%"), set reduction_type to "percentage" and reduction_value to that number (e.g. 20)
- If the question mentions a rupee amount (e.g. "cut by ₹1000" or "reduce by 1000 rupees"), set reduction_type to "amount" and reduction_value to that number (e.g. 1000)
- If no specific number is given (e.g. "how much can I save on entertainment?"), default to reduction_type "percentage" and reduction_value 10
- Do not include any text before or after the JSON object`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return new Response(
        JSON.stringify({ error: "Couldn't understand that question. Please try again." }),
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
      return new Response(
        JSON.stringify({ error: "Could not understand that question. Try rephrasing, e.g. 'What if I reduce food by 20%?'" }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_CATEGORIES.includes(parsed.category) || !parsed.reduction_value || !["percentage","amount"].includes(parsed.reduction_type)) {
      return new Response(
        JSON.stringify({ error: "Couldn't fully understand that question. Try mentioning a specific category and percentage or amount." }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
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
