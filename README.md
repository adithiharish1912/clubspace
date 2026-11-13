# ClubSpace – Club Membership Management System

A complete MERN-stack web application for running a club: member registration, membership plans, online payments (Razorpay), QR-code attendance, events, email/WhatsApp notifications, dashboards and Excel/PDF reports — with separate experiences for **Super Admin, Club Admin, Staff and Members**.

| | |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router 6, Axios, Recharts, html5-qrcode |
| **Backend** | Node.js 18+, Express 4, REST API, JWT, bcrypt, express-validator, Helmet, rate limiting |
| **Database** | MongoDB + Mongoose (10 collections, indexes, validation, timestamps) |
| **Integrations** | Razorpay, Cloudinary, SMTP email (Nodemailer), WhatsApp Cloud API |
| **Reports** | ExcelJS (.xlsx) and PDFKit (.pdf); PDF payment receipts |
| **Deploy** | Vercel (frontend) · Render (backend) · MongoDB Atlas · GitHub |

---

## 1. Quick start (local)

**Prerequisites:** Node.js 18 or newer, and MongoDB (local `mongod`, Docker, or a free MongoDB Atlas cluster).

```bash
# 1) Backend
cd backend
cp .env.example .env          # then edit MONGO_URI and JWT_SECRET
npm install
npm run seed -- --demo        # super admin + 5 plans + demo data (omit --demo for a clean start)
npm run dev                   # API on http://localhost:5000

# 2) Frontend (new terminal)
cd frontend
cp .env.example .env          # VITE_API_URL=/api  (Vite proxies to :5000)
npm install
npm run dev                   # app on http://localhost:5173
```

MongoDB with Docker, if you don't have it installed:
`docker run -d --name clubspace-mongo -p 27017:27017 mongo:7`

### Logins after seeding

| Role | Email | Password |
|---|---|---|
| Super Admin | value of `SUPERADMIN_EMAIL` (default `superadmin@clubspace.app`) | value of `SUPERADMIN_PASSWORD` (default `ChangeMe@123`) |
| Club Admin *(demo)* | `admin@clubspace.app` | `Demo@1234` |
| Staff *(demo)* | `staff@clubspace.app` | `Demo@1234` |
| Member *(demo)* | `member@clubspace.app` | `Demo@1234` |

**Change the super admin password immediately** (Profile → Change password). Demo accounts are never created when `NODE_ENV=production`.

### Works without any API keys

Every integration has a safe development fallback, so you can try the whole app before signing up for anything:

| Not configured | What happens |
|---|---|
| Razorpay keys | **Demo payment mode** — a clearly labelled simulated checkout. Disabled automatically in production. |
| Cloudinary | Photos/banners are saved to `backend/uploads/` and served from `/uploads`. |
| SMTP | Emails (verification, reset links, receipts, reminders) are printed in the backend console. Reset/verify links are also returned in the API response. |
| WhatsApp | Messages are logged to the console. |

---

## 2. Features by role

**Super Admin** – everything below, plus: create/disable admins and other super admins, club settings (name, logo, GSTIN, ID/receipt prefixes, reminder schedule, notification channels), integration status.

**Club Admin** – dashboard with revenue/membership analytics; members (CRUD, status, delete); plans (monthly, quarterly, half-yearly, annual, premium, custom); payments, refunds (full/partial, Razorpay refund API), ledger; events (create, edit, cancel, participants); announcements & reminder runs; reports with Excel/PDF export; staff accounts.

**Staff** – front-desk dashboard; register members (with optional login); collect cash/UPI/card payments with receipts; QR / member-ID check-in & check-out; event registrations and fee collection.

**Member** – self-registration with email verification; digital membership card with QR code; choose a plan and pay online; renew early (remaining days carried forward); payment history & PDF receipts; attendance history; event registration (free and paid); notifications; profile & password.

**Automations** (daily cron, also runs at boot and on demand from the admin dashboard): expire memberships, send expiry reminders N days before (default 7/3/1), move events to ongoing/completed, remind event participants the day before.

---

## 3. Project structure

```
clubspace/
├── backend/
│   ├── server.js                 # boots DB, HTTP server, scheduler
│   ├── src/
│   │   ├── app.js                # Express app: security middleware, routes, errors
│   │   ├── config/               # env, db, cloudinary, razorpay
│   │   ├── models/               # 10 Mongoose models
│   │   ├── controllers/          # request handlers per module
│   │   ├── routes/               # REST routes + validation rules
│   │   ├── middleware/           # auth (JWT + RBAC), validate, upload, error
│   │   ├── services/             # payment, membership, notifications, email, WhatsApp,
│   │   │                         #   PDF, Excel, uploads, counters, scheduler, tokens
│   │   ├── utils/                # ApiError, helpers
│   │   └── seed.js               # super admin, default plans, demo data
│   └── tests/api.test.js         # 55 end-to-end API tests
├── frontend/
│   ├── src/
│   │   ├── api/client.js         # Axios instance, auth header, download helper
│   │   ├── context/              # Auth, Theme (dark mode), Payment (Razorpay checkout)
│   │   ├── components/           # UI kit, layout, membership card, plan card, modals
│   │   ├── pages/                # auth, dashboard, members, plans, payments, attendance,
│   │   │                         #   events, notifications, reports, users, settings, profile, my/*
│   │   ├── hooks/                # useFetch, useDebounce
│   │   └── utils/format.js
│   └── vercel.json               # SPA rewrites
├── docs/                         # API, database, testing, deployment
└── render.yaml                   # Render blueprint for the API
```

---

## 4. Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, request flow, payment flow, RBAC matrix, security |
| [docs/DATABASE.md](docs/DATABASE.md) | All collections, fields, relationships, indexes |
| [docs/API.md](docs/API.md) | Every REST endpoint with roles, bodies and responses |
| [docs/TESTING.md](docs/TESTING.md) | Automated test suite + manual QA checklist |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | GitHub → MongoDB Atlas → Render → Vercel, env vars, Razorpay webhook, go-live checklist |

---

## 5. Scripts

| Where | Command | Purpose |
|---|---|---|
| backend | `npm run dev` | API with auto-reload (nodemon) |
| backend | `npm start` | Production start |
| backend | `npm run seed` | Create super admin + default plans (idempotent) |
| backend | `npm run seed -- --demo` | Also create demo users, members, payments, attendance, events |
| backend | `npm test` | Run the API test suite (needs a MongoDB; uses `TEST_MONGO_URI`) |
| frontend | `npm run dev` | Vite dev server with API proxy |
| frontend | `npm run build` | Production build to `frontend/dist` |

---

Built by Kiran D H.
