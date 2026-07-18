// Supabase Edge Function: parse-expense
// Uses Google's Gemini API (free tier, no credit card needed) to parse
// natural language expense text into structured JSON.
// The Gemini API key never reaches the frontend — it lives only here,
// as a server-side secret.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to your real domain once published
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'text' field in request body." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are an expense parser. Extract structured data from this message describing a purchase or expense: "${text}"

Return ONLY valid JSON, nothing else, no markdown formatting, in exactly this shape:
{"amount": number, "category": string, "description": string, "expense_date": "YYYY-MM-DD"}

Rules:
- "category" must be exactly one of: Food, Transport, Shopping, Education, Bills, Entertainment, Health, Other
- "amount" must be a positive number, no currency symbols
- "expense_date" must resolve relative dates (e.g. "yesterday", "today", "last Monday") against today's real date: ${today}
- "description" should be a short, clean summary (e.g. "Dinner", "Petrol", "Movie tickets")
- If any field cannot be confidently determined, make your best reasonable guess — never leave a field blank
- Do not include any text before or after the JSON object`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI parsing failed. Please try again." }),
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
        JSON.stringify({ error: "Could not understand that expense. Try rephrasing." }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const validCategories = ["Food","Transport","Shopping","Education","Bills","Entertainment","Health","Other"];
    if (!parsed.amount || !validCategories.includes(parsed.category) || !parsed.expense_date) {
      return new Response(
        JSON.stringify({ error: "AI returned incomplete data. Try rephrasing your expense." }),
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
