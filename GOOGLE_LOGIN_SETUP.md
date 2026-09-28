# Google login + password reset — setup checklist

Do these once. Nothing here costs money.

## A. Google Cloud (creates the "Sign in with Google" app)
1. Go to https://console.cloud.google.com → project picker → **New project** → name it `Moneo` → Create.
2. Left menu → **APIs & Services → OAuth consent screen** (newer UI: **Google Auth Platform**) → **Get started**.
   - App name: `Moneo` · User support email: your email
   - Audience: **External**
   - Contact email: your email → Create
3. **Branding**: add your app's home page (your Vercel URL) and a privacy policy URL when you have one.
   Skip the logo for now — uploading one triggers Google's verification review.
4. **Audience** → while testing, add your team's Gmail addresses under **Test users**.
   Before the demo, click **Publish app** so anyone can sign in (email/profile only needs no review).
5. **Clients → Create client** → Application type **Web application** → name `Moneo web`.
   - **Authorized JavaScript origins** (needed for One Tap):
     - `http://localhost:5173`
     - `http://localhost`
     - `https://YOUR-APP.vercel.app`
   - **Authorized redirect URIs**:
     - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
       (copy the exact value from Supabase's Google provider page — step B2)
   - Create → copy the **Client ID** and **Client secret**.

## B. Supabase
1. Dashboard → your project → **Authentication → Sign In / Providers → Google** → Enable.
2. Paste **Client ID** and **Client secret** → Save. (The "Callback URL" shown here is what goes in A5.)
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://YOUR-APP.vercel.app` (or `http://localhost:5173` while developing)
   - **Redirect URLs** → add all of:
     - `http://localhost:5173/**`
     - `https://YOUR-APP.vercel.app/**`
4. (Recommended) **Authentication → Emails → Reset password** template: the default works; you can
   change the wording to "Reset your Moneo password".
5. Run `backend/supabase_migration_001.sql` in the SQL Editor if you haven't yet.

## C. Your code
1. `.env` (frontend root): add `VITE_GOOGLE_CLIENT_ID=<Client ID from A5>` (for One Tap).
2. Vercel → Project → Settings → Environment Variables: add the same `VITE_GOOGLE_CLIENT_ID`,
   plus `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL` → Redeploy.
3. Restart `npm run dev` after editing `.env`.

## D. Test
- Login page → **Continue with Google** → pick account → you land on the dashboard with your Google name/photo.
- Open the site again later → you're still logged in (Supabase keeps the session).
- Log out, reload the login page → the One Tap "Continue as …" popup appears (Chrome may take a moment).
- **Forgot password?** → enter email → open the email link **in the same browser** → set a new password.

## Troubleshooting
- `redirect_uri_mismatch` → A5 redirect URI must equal Supabase's callback URL exactly.
- Back on the login page after Google, not logged in → your site URL is missing from B3 Redirect URLs.
- One Tap never shows → origin missing in A5, `VITE_GOOGLE_CLIENT_ID` not set, or you closed the popup
  several times (Google hides it for a while — test in an incognito window).
- "Access blocked: app not verified / not in test users" → add yourself in A4 or publish the app.
- Reset link says expired → it only works once, for 1 hour, in the browser where you requested it.
