# Deploying Moneo

Moneo has two parts that deploy separately:

| Part | What it is | Where | Cost |
|---|---|---|---|
| Frontend | React + Vite (this folder) | **Vercel** | Free |
| Backend | Node.js + Express AI server (`backend/`) | **Render** | Free |
| Database + login | Supabase (already set up) | supabase.com | Free |

Total time: about 30 minutes.

---

## 1. Put the project on GitHub

```bash
cd moneo
git init
git add .
git commit -m "Moneo 2.0"
git branch -M main
git remote add origin https://github.com/<your-username>/moneo.git
git push -u origin main
```

Before pushing, check that **no `.env` file is listed** in `git status`. The
`.gitignore` already excludes them — your real keys stay on your computer.

The repo includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that
builds the frontend and checks the backend on every push. A green check on
GitHub means the code builds.

## 2. Supabase (database + login)

In the Supabase dashboard → **SQL Editor**, run these files in order (all are safe to re-run):

1. `backend/supabase_schema.sql`
2. `backend/supabase_chat_schema.sql`
3. `backend/supabase_migration_001.sql`

Keep **Project URL** and **anon public key** (Settings → API) for step 4.

## 3. Backend on Render

1. Go to https://render.com → sign in with GitHub → **New → Blueprint** → pick your repo.
   Render reads `render.yaml` and creates `moneo-backend`.
2. When asked for environment variables:
   - `GEMINI_API_KEY` → your key from https://aistudio.google.com/app/apikey
   - `ALLOWED_ORIGINS` → `http://localhost:5173` for now (you'll add the Vercel URL in step 5)
3. Deploy. When it's live, open `https://<your-service>.onrender.com/api/health` —
   you should see `{"status":"ok"...}`. Copy this base URL.

> Render's free plan sleeps after 15 minutes without traffic. The first AI
> request after that takes ~30–60 seconds while it wakes up. Open the health
> URL a minute before a demo to wake it.

## 4. Frontend on Vercel

1. Go to https://vercel.com → sign in with GitHub → **Add New → Project** → import the repo.
   Framework "Vite" is detected automatically (settings are in `vercel.json`).
2. **Environment Variables** — add:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon public key |
   | `VITE_BACKEND_URL` | your Render URL, e.g. `https://moneo-backend.onrender.com` (no trailing `/`) |
   | `VITE_GOOGLE_CLIENT_ID` | your Google Web Client ID (optional, for One Tap) |

3. **Deploy**. You get a URL like `https://moneo.vercel.app`.

## 5. Connect everything to the live URL

- **Render** → moneo-backend → Environment → `ALLOWED_ORIGINS` =
  `https://moneo.vercel.app,http://localhost:5173` → Save (it redeploys).
- **Supabase** → Authentication → URL Configuration:
  Site URL = `https://moneo.vercel.app`; Redirect URLs add `https://moneo.vercel.app/**`.
- **Google Cloud** (if using Google login) → your OAuth client:
  add `https://moneo.vercel.app` to Authorized JavaScript origins.
  See `GOOGLE_LOGIN_SETUP.md` for the full Google setup.

## 6. Test the live site

- [ ] Landing page loads; nav links scroll to each section
- [ ] Sign up → confirmation email → log in
- [ ] Continue with Google
- [ ] Add a transaction, reload — it's still there
- [ ] Scan a receipt (tests the backend + Gemini)
- [ ] Ask the AI assistant a question
- [ ] Forgot password → email link → set new password
- [ ] Open on a phone

## Updating later

Push to `main` — Vercel and Render redeploy automatically.

## Troubleshooting

- **"Can't reach the backend server"** → `VITE_BACKEND_URL` is wrong or missing on Vercel
  (redeploy after changing env vars), or Render is still waking up.
- **AI requests fail only on the live site** → your Vercel URL is missing from `ALLOWED_ORIGINS`.
- **Login works locally but not live** → Supabase Redirect URLs don't include the Vercel URL.
- **Blank page** → `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing on Vercel.
