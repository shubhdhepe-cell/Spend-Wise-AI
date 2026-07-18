# SpendWise AI 💰✨

An AI-powered personal expense tracker that lets you log spending by **typing or speaking** in plain English, then understand your habits through an **AI Financial Coach** and a **What-If Savings Simulator** — all grounded in your real data, never invented numbers.

🔗 **Live demo:** [spend-wise-ai-002.netlify.app](https://spend-wise-ai-002.netlify.app/)

> Click **"Continue as Guest"** on the login screen — no email or sign-up required to try it out.

---

## ✨ Features

- **Natural language expense entry** — type "I spent ₹450 on dinner yesterday" and AI extracts the amount, category, description, and date
- **Voice input** — speak your expense using the browser's built-in speech recognition; it's transcribed and parsed the same way as typed text
- **Editable confirmation** — every AI-parsed expense is shown for review/edit before it's saved; nothing is auto-saved without confirmation
- **Live dashboard** — today / this week / this month totals, calculated directly from real database data
- **Expense History** — filter by category and date range
- **Edit & Delete** — full control over saved expenses
- **AI Financial Coach** — ask questions like *"Where am I spending the most?"* and get answers grounded strictly in your real statistics (computed by app code, not invented by AI)
- **What-If Savings Simulator** — ask *"What if I reduce food by 20%?"* and get a real, calculated monthly/yearly savings projection
- **Guest sign-in** — try the full app instantly with no email/password required
- **Fully responsive** — works on both desktop and mobile

---

## 🧠 How AI is used (and how it isn't)

A core design principle of this project: **AI never invents or calculates financial figures.**

| Task | Who does it |
|---|---|
| Understanding natural language expense text | AI (Gemini) |
| Understanding voice-transcribed text | AI (Gemini) |
| Categorizing expenses | AI (Gemini) |
| Understanding "what-if" questions | AI (Gemini) — extracts intent only |
| **Calculating** totals, percentages, savings | **Plain application code**, from real database data |
| Narrating spending insights & recommendations | AI (Gemini) — using only pre-computed real stats |

The AI is only ever given numbers that were already calculated by the app from the database — it explains and reasons over them, but never computes or guesses them itself.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework, no build step — single static file)
- **Backend / Database:** [Supabase](https://supabase.com) — Postgres database, Auth (including anonymous/guest sign-in), Row Level Security
- **Serverless functions:** Supabase Edge Functions (Deno)
- **AI:** [Google Gemini API](https://aistudio.google.com) (`gemini-flash-latest`) — free tier, called only from Edge Functions, never exposed to the frontend
- **Voice input:** Browser-native Web Speech API
- **Hosting:** [Netlify](https://netlify.com)

---

## 📂 Project Structure

```
├── index.html                  # The entire frontend app (UI + logic)
├── spendwise-schema.sql        # Supabase database schema (tables, RLS, triggers, views)
├── parse-expense-gemini.ts     # Edge Function: parses natural language → structured expense JSON
├── whatif-parse.ts             # Edge Function: parses "what-if" questions → structured intent
├── coach-ask.ts                # Edge Function: AI Financial Coach — narrates real stats only
└── README.md
```

---

## 🚀 Setup (to run your own copy)

### 1. Create a Supabase project
- Go to [supabase.com](https://supabase.com) → New Project

### 2. Run the database schema
- Open **SQL Editor** → New query → paste the contents of `spendwise-schema.sql` → **Run**
- This creates the `expenses` and `profiles` tables, Row Level Security policies, and a trigger that auto-creates a profile on signup (including guest sign-ins)

### 3. Enable Auth methods
- **Authentication → Providers** → ensure **Email** is enabled
- **Authentication → Sign In / Providers** → enable **Anonymous sign-ins** (powers the "Continue as Guest" button)

### 4. Deploy the Edge Functions
Via the Supabase Dashboard (**Edge Functions → Deploy a new function → Via Editor**), create three functions using the code in this repo:
- `parse-expense` ← `parse-expense-gemini.ts`
- `whatif-parse` ← `whatif-parse.ts`
- `coach-ask` ← `coach-ask.ts`

### 5. Add your Gemini API key as a secret
- Get a free key at [aistudio.google.com](https://aistudio.google.com)
- In Supabase: **Edge Functions → Manage secrets** → add `GEMINI_API_KEY`

### 6. Configure the frontend
In `index.html`, fill in your project's values:
```js
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_KEY";
const EDGE_FUNCTION_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/parse-expense";
const WHATIF_FUNCTION_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatif-parse";
const COACH_FUNCTION_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/coach-ask";
```

### 7. Run it
Since it's a single static file, just open `index.html` in a browser — or serve it locally:
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000/index.html`.

### 8. Deploy (optional)
Drag `index.html` into [app.netlify.com/drop](https://app.netlify.com/drop) for instant free hosting. Afterward, update **Authentication → URL Configuration → Site URL** in Supabase to your live URL.

---

## 🔒 Security notes

- API keys for Gemini are stored as Supabase secrets and only ever used inside Edge Functions — never exposed to the browser
- Row Level Security ensures every user (including guests) can only ever read/write their own data
- The Supabase **publishable/anon key** used in the frontend is safe to expose publicly by design — it has no special privileges beyond what RLS allows

---

## 📄 License

Built for hackathon purposes. Feel free to fork and extend.
