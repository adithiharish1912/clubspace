# Architecture

## Overview

```
┌──────────────────────┐   HTTPS + JWT (Bearer)   ┌────────────────────────────┐      ┌──────────────────┐
│  React SPA (Vercel)  │ ───────────────────────▶ │  Express REST API (Render) │ ───▶ │ MongoDB (Atlas)  │
│  Vite · Tailwind     │ ◀─────────────────────── │  /api/*                    │      └──────────────────┘
└─────────┬────────────┘        JSON / files      └───┬──────┬──────┬──────┬───┘
          │ Razorpay Checkout (JS)                    │      │      │      │
          ▼                                           ▼      ▼      ▼      ▼
   ┌──────────────┐  webhook (HMAC) ───────────▶  Razorpay  Cloudinary  SMTP  WhatsApp Cloud API
   │  Razorpay    │                               (orders,   (images)   (email)
   └──────────────┘                                refunds)
```

* **Stateless API.** Each request carries a JWT; the server re-loads the user on every request so deactivation and password changes take effect immediately (a `tokenVersion` claim revokes old tokens after a password change/reset).
* **Layered backend:** `routes` (URL + validation + role guard) → `controllers` (HTTP in/out) → `services` (business rules shared across controllers and the scheduler) → `models`.
* **Frontend:** route-level code splitting (`React.lazy`), an `AuthContext` for the session, a `PaymentContext` that owns the Razorpay checkout, and a single `useFetch` hook for GET requests.

## Request lifecycle

`helmet` → `cors` (allow-list from `CLIENT_URL`) → `compression` → JSON body (1 MB) → `express-mongo-sanitize` → rate limiter (300/min/IP; 30 per 15 min on auth endpoints) → route → `protect` (JWT) → `authorize(roles)` → `validate(rules)` → controller → central `errorHandler` (consistent `{ success, message, errors? }` shape; stack traces hidden in production).

## Role-based access control

`superadmin` passes every `authorize()` check. Members can only read their own records (`assertMemberAccess`).

| Capability | Super Admin | Admin | Staff | Member |
|---|:-:|:-:|:-:|:-:|
| Admin dashboard & analytics | ✔ | ✔ | – | – |
| Staff dashboard | ✔ | ✔ | ✔ | – |
| Member dashboard | – | – | – | ✔ |
| List / create / edit members | ✔ | ✔ | ✔ | own profile |
| Change member status, delete member | ✔ | ✔ | – | – |
| Create / edit / delete plans | ✔ | ✔ | – | view active |
| Buy / renew plan online | – | – | – | ✔ |
| Record cash/UPI/card payment | ✔ | ✔ | ✔ | – |
| Refunds, transaction ledger | ✔ | ✔ | – | – |
| View payments & receipts | ✔ | ✔ | ✔ | own |
| QR / manual check-in & check-out | ✔ | ✔ | ✔ | – |
| View attendance | ✔ | ✔ | ✔ | own |
| Create / edit / cancel events | ✔ | ✔ | – | – |
| Register for events | anyone (staff on behalf) | | | self |
| Broadcast announcements, run reminders | ✔ | ✔ | – | – |
| Reports & exports | ✔ | ✔ | – | – |
| Manage staff accounts | ✔ | ✔ | – | – |
| Manage admins / super admins | ✔ | – | – | – |
| Club settings | ✔ (edit) | view | – | – |

## Membership & payment flow

```
Member picks plan ─▶ POST /subscriptions          (status: pending, price snapshot + tax)
                 ─▶ POST /payments/order          (Payment: created, Razorpay order created server-side)
                 ─▶ Razorpay Checkout in browser
                 ─▶ POST /payments/verify         (HMAC-SHA256(order_id|payment_id, key_secret) checked)
                        └▶ completePayment()  ◀── also triggered by webhook payment.captured
                              • atomic claim (status created→paid) ⇒ idempotent, no double activation
                              • receipt number RCPT-YYYY-NNNNNN
                              • Transaction (credit) in ledger
                              • activateSubscription(): start = max(now, current expiry) ⇒ early renewals stack
                              • Member → active, membershipExpiry updated
                              • notification + email with PDF receipt (+ WhatsApp if enabled)
```

Staff counter payments use `POST /payments/offline`, which runs the same `completePayment()` pipeline. Refunds create a debit ledger row; a full refund of a membership payment cancels that subscription and recomputes the member's expiry.

## Attendance

Each member has a random `qrToken`. The QR encodes `CLUBSPACE:<token>` (not the member ID, so a printed ID can't be forged into a QR). Staff scan with the device camera (html5-qrcode) or type the member ID; one call toggles check-in/check-out. Entry is refused if the membership isn't active or has expired. A lost card can be re-issued, which invalidates the old QR.

## Scheduler

`node-cron` runs `runDailyJobs()` daily at `REMINDER_CRON` (default 09:00 server time) and 15 seconds after boot (so a sleeping free-tier server catches up). Admins can also run it from the dashboard. Reminders are de-duplicated per subscription via `remindersSent`.

## Security checklist

* bcrypt (cost 12) password hashing; passwords never returned (`select: false` + `toJSON` transform)
* JWT with expiry, token version revocation, deactivated users rejected
* Strong-password rule, email/phone validation, ObjectId validation on every `:id`
* NoSQL injection: `express-mongo-sanitize` + typed validators
* Rate limiting (global and stricter on login/register/reset)
* Password-reset and verification tokens stored as SHA-256 hashes, short expiry, same response for unknown emails
* Razorpay signature verification (timing-safe compare) and webhook HMAC on the raw body
* Uploads: image MIME allow-list, 5 MB limit, stored on Cloudinary
* CORS allow-list, Helmet headers, `trust proxy` for Render
* Secrets only in environment variables; `.env` is git-ignored; integration keys are never sent to the browser (only the public Razorpay key id)
