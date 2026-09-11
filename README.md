# Moneo 2.0 (모니오) — AI-Powered Personal Finance Management

A capstone project: a real, working personal finance web app where you can
manually track spending, or point your phone at a receipt and let Google's
Gemini API read it for you.

```
Receipt Image → Gemini AI → Structured Data → Your Review → Confirm → Transaction
                                                                 ↓
                                          Dashboard / Analytics / Budgets
                                                                 ↓
                                                   AI Financial Assistant
```

This runs **entirely on your own computer plus one free cloud
database** — no Docker, no paid hosting yet. Your data and login are
real (Supabase), while the AI logic runs through a small local backend
that's the only thing holding your Gemini API key.

---

## 1. Architecture

```
React + Vite  (frontend, localhost:5173)
       ↓  fetch()                    ↓  Supabase client
Node.js + Express                Supabase (Auth + Database)
(backend, localhost:4000)        — real login, real cloud storage
       ↓
Gemini API  (Google)
```

- **The frontend never sees your Gemini API key.** It only makes plain
  `fetch()` calls to your own backend for anything AI-related.
- **The backend is the only thing that talks to Gemini.** Your key lives
  in `backend/.env`, which is never committed to git.
- **Login and data storage are handled by Supabase** — real accounts
  with email verification, and your transactions/budgets/goals/notes
  stored in a real PostgreSQL database, protected by Row Level Security
  so no user can ever see another user's data.
- **New accounts start completely empty.** ₩0 everywhere. Sample data
  is never generated automatically — see Section 10 (Demo Tools).

---

## 2. Requirements

- **Node.js** (which includes npm) — download the LTS version from
  https://nodejs.org if you don't have it. Check with:
  ```
  node -v
  npm -v
  ```
- **A free Gemini API key** — see Section 4.
- **A free Supabase account** — see Section 5.

---

## 3. Project structure

```
moneo/
  src/                    # Frontend (React + Vite)
    components/
    pages/
    services/              # assistantService.js — talks to the backend
    utils/                 # storage.js (Supabase), calculations.js, supabaseClient.js
    data/
    context/               # AppContext.jsx — auth + data state via Supabase
  backend/                 # Backend (Node + Express) — Gemini AI only
    src/
      server.js
      routes/
        ai.js               # POST /api/ai/chat, /api/ai/insight
        receipt.js          # POST /api/receipt/analyze
      services/
        geminiService.js    # the ONLY file that touches the Gemini SDK/key
        receiptService.js   # Korean-aware receipt parsing, confidence scoring
        assistantEngine.js  # chat + proactive insight prompt logic
    supabase_schema.sql     # run once in Supabase's SQL Editor
    .env.example
    package.json
  package.json              # frontend
  .env.example               # frontend (Supabase URL/key + backend URL)
  README.md
```

---

## 4. Get a free Gemini API key

1. Go to **https://aistudio.google.com**
2. Sign in with any Google account — no phone verification, no card
3. Click **"Get API key"** in the left sidebar → **"Create API key"**
4. Copy it — it starts with `AIza...`

That's a real key tied to your own account. Free tier covers everything
this project needs many times over — a full capstone demo costs a
fraction of a cent.

---

## 5. Set up Supabase (real database + real login)

Moneo now uses [Supabase](https://supabase.com) for two things at once:
user accounts (real email/password login with email verification) and
storing your financial data in the cloud instead of just one browser.

1. Go to **supabase.com** → sign up free → **New Project**
2. Once it's created, go to **Settings → API** and copy two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)
3. Go to **SQL Editor → New query**, paste in everything from
   `backend/supabase_schema.sql`, and click **Run**. This creates the
   `user_data` table, locks it down so users can only ever see their own
   data (Row Level Security), and sets up a trigger that gives every new
   signup an empty data row automatically.
4. Go to **Authentication → URL Configuration** and set **Site URL** to
   `http://localhost:5173` for now (update this later if you deploy).

**Both values from step 2 go in the frontend's `.env`** (Section 6 below)
— not the backend's. Supabase's anon key is designed to be used directly
in browser code; it's safe because the Row Level Security rules (not the
key itself) are what actually protect people's data.

## 6. Set up and run the backend

Open a terminal:

```bash
cd moneo/backend
npm install
cp .env.example .env
```

Open the new `backend/.env` file in a text editor and paste your key:

```env
GEMINI_API_KEY=AIzaYourRealKeyHere
GEMINI_MODEL=gemini-2.5-flash
PORT=4000
```

Then start it:

```bash
npm run dev
```

You should see:

```
Moneo backend running at http://localhost:4000
Gemini configured: yes
```

Leave this terminal running. Verify it's alive by opening
**http://localhost:4000/api/health** in a browser — you should see
`{"status":"ok","service":"moneo-backend"}`.

---

## 7. Set up and run the frontend

Before running it, copy the frontend's env file and fill in your
Supabase values from Section 5:

```bash
cd moneo
cp .env.example .env
```

Open `.env` and fill in the two Supabase values you copied earlier:

```env
VITE_BACKEND_URL=http://localhost:4000
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

Then install and run (in this **second** terminal — keep the backend
one running):

```bash
npm install
npm run dev
```

Your browser should open automatically to **http://localhost:5173**.
If not, open it yourself.

---

## 8. Confirm everything is connected

1. **Register** a new account — check your email for a confirmation
   link from Supabase (check spam if it doesn't arrive in a minute)
2. Click that link, then come back and **log in**
3. Go to **Settings**
4. Under **Assistant Mode**, you should see two green "Connected" /
   "Available" status dots for Backend and Moneo AI (Gemini)
5. If either shows red, see Section 13 (Troubleshooting)

---

## 9. Demo flow for your capstone meeting

1. Open `http://localhost:5173`
2. **Register** a new account
3. **Log in** — dashboard shows ₩0 everywhere, empty charts, a "Welcome
   to Moneo" empty state. Say out loud: *"Moneo starts with no
   pre-populated data — everything you're about to see is real."*
4. Go to **Transactions → Scan Receipt**, upload a real receipt photo
   (Korean or English — CU, GS25, a restaurant, anything)
5. Watch the AI analysis animation (reading merchant → checking total →
   detecting category → extracting items)
6. Review the extracted result: merchant, date, total, category,
   payment method, itemized breakdown, and a **confidence badge**
   (High / Review recommended / Low confidence)
7. Optionally tap **Edit** to correct anything, then **Confirm & Save**
8. Return to **Dashboard** — balance, expenses, and category breakdown
   have updated with the real transaction
9. Open **Analytics** — the same transaction appears in the charts
10. Open **Budgets** — create one if you haven't, show usage updating
11. Open **Moneo AI** (the assistant) and ask, in your own words:
    - *"Where did I spend the most money?"*
    - *"How can I reduce my expenses?"*
    - The answers come from your actual transaction data — not scripted
      text
12. If you want more data on screen without scanning ten receipts live,
    go to **Settings → Demo Tools → Generate Sample Month** — say
    plainly that this is a local developer tool for demo purposes, not
    something that happens automatically for real users
13. Switch language to **한국어** in Settings — the whole UI, including
    the AI's answers, changes language
14. Log out, log back in — your data is still there

---

## 10. Demo Tools (Settings)

Since Moneo never auto-generates fake data, **Settings → Demo Tools**
gives you two explicit, local-only buttons:

- **Generate Sample Month** — creates a realistic month of sample
  transactions, budgets, and goals, so you have something to show
  without manually typing in ten transactions during your presentation
- **Clear All Data** — wipes everything back to a genuinely empty state

Both require a confirmation step, since they're destructive.

---

## 11. What the AI actually does

**Chat & proactive insight** (`POST /api/ai/chat`, `/api/ai/insight`):
the backend builds a compact JSON summary of your real spending,
budgets, and goals, and sends it to Gemini along with your question.
The model is explicitly instructed never to invent numbers not present
in that data — if there isn't enough data to answer something, it says
so instead of guessing.

**Receipt analysis** (`POST /api/receipt/analyze`): your photo is sent
to Gemini's vision capability with instructions tuned for Korean
receipts — CU, GS25, 7-Eleven, E-Mart, Olive Young, Starbucks Korea,
restaurants, and transit receipts. It returns merchant, date, total
(normalized to a plain KRW number regardless of whether the receipt
showed "₩17,450", "17,450원", or "KRW 17,450"), category (constrained
to Moneo's own category list — it can never invent one), payment
method, itemized line items, and a 0-100 confidence score.

**Assistant Mode toggle** (Settings): "Demo Mode" answers questions
using local calculations only — free, instant, works with the backend
turned off. "API Mode" routes through the real backend/Gemini pipeline
described above.

---

## 12. Testing checklist

Verified by automated tests during development (headless browser +
mocked network layer, since this environment can't reach Google's
servers to test with a live key):

- [x] Registration creates a new account with **zero** transactions/
      budgets/goals/notes/achievements
- [x] Login / logout / re-login preserves data correctly
- [x] All 8 pages (Dashboard, Transactions, Analytics, Budgets, Goals,
      Notes, Assistant, Settings) render cleanly with empty data — no
      crashes, no fake numbers
- [x] Manual transaction add/edit/delete works and updates the
      dashboard immediately
- [x] Backend health check, chat, insight, and receipt endpoints all
      return correct responses and friendly errors (tested with curl
      and a mocked Gemini layer standing in for the real API)
- [x] Korean won normalization: `"₩17,450"`, `"17,450원"`, and
      `"KRW 17,450"` all correctly parse to the integer `17450`
- [x] Confidence thresholds match spec exactly: ≥90 → High, 70-89 →
      Review recommended, <70 → Low confidence
- [x] Frontend correctly detects when the backend is unreachable and
      shows a clear bilingual message instead of crashing
- [x] Category is always constrained to Moneo's real category list,
      even in the raw Gemini response
- [x] Supabase auth logic tested with a mocked client (since this
      environment can't reach your real Supabase project either):
      registration with email confirmation required, duplicate email
      correctly rejected, weak password correctly rejected, wrong
      password correctly rejected, unconfirmed-email login correctly
      blocked with the right message, successful login normalizes the
      user object correctly, saving a transaction writes through the
      new Supabase persist path, and logout correctly clears state —
      all 9 scenarios passed
- [x] Full app builds cleanly and the Login page mounts with zero
      runtime errors under the new Supabase-based auth wiring

**What you need to test manually** (requires your real API key and
Supabase project, which I don't have access to):

- [ ] A real receipt photo produces a sensible, accurate extraction —
      try at least one Korean receipt and one English receipt
- [ ] The confidence score feels honest on a blurry or angled photo
      (should score noticeably lower than a clean scan)
- [ ] The AI Assistant's answers to open-ended questions feel accurate
      and genuinely reference your data
- [ ] Response latency feels acceptable for a live demo (typically 1-3
      seconds per Gemini call, depending on your connection)
- [ ] **Your first real registration** — confirm the email actually
      arrives, the link works, and you can log in afterward
- [ ] Log in from a second browser (or Incognito) with the same
      account and confirm your data appears — this is the real proof
      the migration off localStorage worked

---

## 13. Troubleshooting

**"Please confirm your email first" when trying to log in**
Expected behavior, not a bug — Supabase requires clicking the
confirmation link sent to your email before you can log in. Check
spam/junk if it didn't arrive within a minute or two.

**Registered but never got a confirmation email**
Check Supabase dashboard → Authentication → Users — if your account
shows up there but unconfirmed, the email may have gone to spam or
Supabase's free-tier email sending hit a rate limit (a handful of
signups is fine; dozens in a short time may get throttled). You can
also manually confirm a user from that same Users page for testing.

**Dashboard shows nothing / stuck loading after login**
Almost always means `backend/supabase_schema.sql` wasn't run yet, so
the `user_data` table (or its automatic-row trigger) doesn't exist.
Go to Supabase → SQL Editor and run that file's contents.

**"new row violates row-level security policy" error**
The RLS policies from `supabase_schema.sql` weren't created, or were
partially created. Re-run the whole schema file — it's safe to run
again, `create table if not exists` won't duplicate anything.

**Settings shows "Backend: Offline"**
The backend isn't running. Open a terminal, `cd backend`, run
`npm run dev`, and leave it open.

**Settings shows "Moneo AI: Not configured"**
Backend is running, but `backend/.env` is missing `GEMINI_API_KEY`, or
it's still the placeholder value. Add your real key and restart the
backend (`Ctrl+C`, then `npm run dev` again).

**Receipt scan fails with "Couldn't read that receipt"**
Gemini genuinely couldn't parse the image — try a clearer, more
well-lit photo, or enter the expense manually. This is expected
behavior for illegible receipts, not a bug.

**"npm install" fails**
Make sure you're in the right folder (should contain `package.json`).
Try `npm cache clean --force` and retry.

**Port already in use**
Close other terminals running `npm run dev`, or change `PORT` in
`backend/.env` (and update `VITE_BACKEND_URL` in the frontend's `.env`
to match).

**My data disappeared**
Your data now lives in Supabase, not the browser — logging in from a
different browser or computer should show the same data. If it's
genuinely missing, check Supabase → Table Editor → `user_data` to see
if your row exists and has the expected content.

---

## 14. Known limitations (worth mentioning to your professor)

- **Auth and data storage are now real** — Supabase handles password
  hashing, email verification, and secure sessions properly; your data
  lives in a real PostgreSQL database with Row Level Security, not a
  browser. This is a genuine upgrade from the earlier localStorage
  version, not a demo simulation of one.
- **The backend has no auth on its own AI endpoints** — anything that
  can reach `localhost:4000` could call the Gemini chat/receipt routes.
  Not a concern running locally; a public deployment should add a check
  that confirms the request comes from a logged-in Supabase user before
  calling Gemini, to prevent random abuse of your API quota.
- **No custom domain or paid hosting yet** — currently runs on
  `localhost`. Free hosting (Vercel + Render) is the natural next step
  if you want a shareable public link.
- **Gemini can occasionally misread a receipt**, especially faded
  thermal paper or extreme angles — that's exactly what the confidence
  score and manual Edit step are there for.
