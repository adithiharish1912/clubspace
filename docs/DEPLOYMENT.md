# Deployment guide

Target setup: **GitHub** (source) → **MongoDB Atlas** (database) → **Render** (API) → **Vercel** (frontend).
Free tiers of all four are enough to start.

---

## Step 1 – Push to GitHub

```bash
cd clubspace
git init
git add .
git commit -m "ClubSpace v1.0"
git branch -M main
git remote add origin https://github.com/<you>/clubspace.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `dist`, `.env` and `backend/uploads`. **Never commit `.env`.**

## Step 2 – MongoDB Atlas

1. Create a free **M0** cluster at <https://cloud.mongodb.com> (region close to your users, e.g. Mumbai `ap-south-1`).
2. *Database Access* → add a user with a strong password (role: *Read and write to any database*).
3. *Network Access* → add `0.0.0.0/0` (Render's free tier has no fixed IP). Use a strong DB password.
4. *Connect → Drivers* → copy the connection string and add the database name:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/clubspace?retryWrites=true&w=majority`
   (URL-encode special characters in the password, e.g. `@` → `%40`.)

## Step 3 – Backend on Render

**Option A – Blueprint (recommended):** Render → *New → Blueprint* → pick the repo. `render.yaml` creates the `clubspace-api` web service (root `backend`, health check `/api/health`, auto-generated `JWT_SECRET`). Fill in the secrets it asks for.

**Option B – manual:** *New → Web Service* → repo → Root directory `backend`, Build `npm ci --omit=dev`, Start `npm start`, Health check path `/api/health`.

### Environment variables

| Variable | Required | Example / notes |
|---|:-:|---|
| `NODE_ENV` | ✔ | `production` |
| `MONGO_URI` | ✔ | Atlas string from step 2 |
| `JWT_SECRET` | ✔ | 64+ random chars – `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | | `7d` |
| `CLIENT_URL` | ✔ | your Vercel URL, e.g. `https://clubspace.vercel.app` (comma-separate several, incl. custom domain) |
| `TZ` | | `Asia/Kolkata` – used for daily attendance dates and the reminder schedule |
| `REMINDER_CRON` | | `0 9 * * *` (09:00 daily) |
| `SUPERADMIN_NAME/EMAIL/PASSWORD` | ✔ for seeding | first super admin |
| `REQUIRE_EMAIL_VERIFICATION` | | `true` to block unverified member logins |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | ✔ for payments | from Razorpay *Settings → API Keys* (test keys `rzp_test_…` first) |
| `RAZORPAY_WEBHOOK_SECRET` | recommended | the secret you set in step 5 |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | ✔ | Render's disk is ephemeral – uploads must go to Cloudinary |
| `SMTP_HOST/PORT/SECURE/USER/PASS`, `EMAIL_FROM` | recommended | e.g. Gmail: `smtp.gmail.com`, `587`, `false`, your address, a 16-char **App Password**; or Brevo/SendGrid/Amazon SES |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DEFAULT_COUNTRY_CODE` | optional | Meta WhatsApp Cloud API (see below) |

> In production, demo payments are disabled. Without Razorpay keys, online payment buttons return "Online payments are not configured" – counter payments still work.

### Create the first super admin

Render → your service → *Shell*:

```bash
npm run seed          # super admin from SUPERADMIN_* + default plans; safe to run again
```

(No shell on the free plan? Run it once from your computer with `MONGO_URI` set to the Atlas string: `cd backend && MONGO_URI="mongodb+srv://…" npm run seed`.)

Check: `https://<service>.onrender.com/api/health` → `{"success":true,"status":"ok"}`.

> **Free-tier note:** Render free services sleep after ~15 minutes idle; the first request then takes ~30–50 s. The scheduler catches up 15 s after each wake-up, and admins can press *Run reminders* any time. For reliable 09:00 reminders, use a paid instance or ping `/api/health` every 10 minutes with a free uptime monitor.

## Step 4 – Frontend on Vercel

1. Vercel → *Add New → Project* → import the repo.
2. **Root directory:** `frontend` · Framework preset: **Vite** · Build: `npm run build` · Output: `dist`.
3. Environment variable: `VITE_API_URL = https://<service>.onrender.com/api`
4. Deploy. `vercel.json` rewrites all routes to `index.html` so deep links like `/members/123` work.
5. Copy the Vercel URL back into Render's `CLIENT_URL` (CORS + links in emails) and redeploy the API.

Custom domain: add it in Vercel → *Domains*, then add it to `CLIENT_URL` as well.

## Step 5 – Razorpay

1. Complete KYC/activation in the Razorpay dashboard (needed for live mode).
2. *Settings → API Keys* → generate keys → set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on Render.
3. *Settings → Webhooks → Add*:
   - URL: `https://<service>.onrender.com/api/payments/webhook`
   - Secret: any strong string → also set as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
4. Test end-to-end with test keys, then swap in live keys.

The webhook makes payments robust: if a member closes the browser right after paying, the webhook still activates the membership (processing is idempotent).

## Step 6 – Cloudinary

Sign up at <https://cloudinary.com> → *Dashboard* → copy cloud name, API key, API secret into Render. Images go to `clubspace/members`, `avatars`, `events`, `branding` folders, resized to ≤800 px.

## Step 7 – WhatsApp (optional)

1. <https://developers.facebook.com> → create an app → add **WhatsApp** → get a *Phone number ID* and a **permanent** access token (System User in Business Manager).
2. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`; turn on *WhatsApp notifications* in ClubSpace *Settings*.
3. Meta only allows free-form text inside a 24-hour customer-service window. For reminders to members who haven't messaged you, create and get approval for **message templates** in WhatsApp Manager, then adapt `src/services/whatsapp.service.js` to send `type: "template"`.

## Go-live checklist

- [ ] `NODE_ENV=production`, strong unique `JWT_SECRET`
- [ ] Super admin password changed after first login
- [ ] `CLIENT_URL` matches the exact Vercel/custom domain (no trailing slash)
- [ ] Razorpay live keys + webhook returning 200
- [ ] Cloudinary configured (uploads otherwise disappear on Render redeploys)
- [ ] SMTP tested (Forgot password email arrives)
- [ ] Club name, address, GSTIN, prefixes set in *Settings* (they appear on receipts)
- [ ] Atlas: automated backups enabled (paid tiers) or scheduled `mongodump`
- [ ] Uptime monitor on `/api/health`

## Updating

Push to `main` → Render and Vercel redeploy automatically. Run `npm run seed` again only if you want to add missing default plans (it never overwrites data).
