# REST API reference

Base URL: `http://localhost:5000/api` (production: `https://<your-render-app>.onrender.com/api`)

**Auth:** send `Authorization: Bearer <token>` (token from `/auth/login` or `/auth/register`).
**Roles:** SA = superadmin, A = admin, S = staff, M = member, 🌐 = public. SA can call every endpoint.
**Responses:** `{ "success": true, "data": …, "meta"?: { total, page, limit, pages } }` or `{ "success": false, "message": "…", "errors"?: [{ field, message }] }`.
**Status codes:** 200 OK · 201 Created · 400 Bad request · 401 Not logged in / token invalid · 403 Forbidden · 404 Not found · 409 Duplicate · 422 Validation failed · 429 Too many requests · 500 Server error.
**Pagination:** list endpoints accept `page` (default 1) and `limit` (default 10, max 100).

---

## Health
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/health` | 🌐 | `{ status: "ok" }` |

## Auth – `/auth`
| Method | Path | Role | Body / notes |
|---|---|---|---|
| POST | `/register` | 🌐 | `{ firstName, lastName?, email, phone, password, gender?, dateOfBirth? }` → `{ token, user, member }`. Creates a member account (status `pending`) and sends a verification email. Password: ≥8 chars, a letter and a number. |
| POST | `/login` | 🌐 | `{ email, password }` → `{ token, user, member }` |
| POST | `/logout` | any | client discards the token |
| GET | `/me` | any | `{ user, member }` |
| GET | `/verify-email/:token` | 🌐 | marks email verified |
| POST | `/resend-verification` | any | |
| POST | `/forgot-password` | 🌐 | `{ email }` – always 200 (no account enumeration) |
| POST | `/reset-password/:token` | 🌐 | `{ password }` – revokes existing tokens |
| PATCH | `/change-password` | any | `{ currentPassword, newPassword }` → new `token` |
| PATCH | `/profile` | any | multipart: `name?`, `phone?`, `avatar?` (image) |

> In development without SMTP, `register`, `resend-verification` and `forgot-password` also return `devVerifyUrl` / `devResetUrl`.

## Members – `/members`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/` | A, S | Query: `q` (name/email/phone/ID), `status`, `gender`, `expiring` (days), `sort` (`-createdAt`, `firstName`, `membershipExpiry`, `membershipId`…), `page`, `limit` |
| POST | `/` | A, S | `{ firstName, lastName?, email, phone, gender?, dateOfBirth?, address?, emergencyContact?, occupation?, notes?, planId?, createLogin?, password? }` → `{ member, subscription? }` |
| GET | `/:id` | A, S, M(own) | `{ member, subscriptions, payments, stats }` |
| PATCH | `/:id` | A, S, M(own, limited fields) | same fields as create |
| PATCH | `/:id/status` | A | `{ status: active|suspended|cancelled|expired|pending, reason? }` |
| DELETE | `/:id` | A | only if no payment history |
| POST | `/:id/photo` | A, S, M(own) | multipart `photo` |
| GET | `/:id/qr` | A, S, M(own) | `{ dataUrl }` PNG QR for check-in |
| POST | `/:id/qr/regenerate` | A, S, M(own) | invalidates the previous QR |
| GET | `/:id/subscriptions` | A, S, M(own) | membership history |

## Membership plans – `/plans`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/` | any | active plans; admins may pass `all=true` |
| GET | `/:id` | any | |
| POST | `/` | A | `{ name, code, durationType: monthly|quarterly|half-yearly|annual|custom, durationDays?, price, taxPercent?, description?, features?[], isPremium?, isActive?, color?, sortOrder? }` |
| PATCH | `/:id` | A | any of the above |
| DELETE | `/:id` | A | deactivates instead if the plan has subscriptions |

## Subscriptions – `/subscriptions`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/` | any (M sees own) | Query: `status`, `type`, `member` |
| POST | `/` | M (self), A/S (`memberId`) | `{ planId, memberId? }` → pending subscription (`type` new/renewal, `amount` incl. tax). Supersedes older pending ones. |
| PATCH | `/:id/cancel` | A | pending only |

## Payments – `/payments`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/config` | any | `{ keyId, demoMode, enabled, currency }` |
| POST | `/order` | M (own), A/S | `{ subscriptionId }` or `{ eventId, memberId? }` → `{ paymentId, order: { id, amount (paise), currency }, keyId, demoMode, prefill }` |
| POST | `/verify` | owner | `{ paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` – verifies HMAC then activates membership |
| POST | `/demo/complete` | owner | `{ paymentId }` – **demo mode only** (no Razorpay keys, not production) |
| POST | `/:id/failed` | owner | `{ reason? }` – checkout closed/failed |
| POST | `/offline` | A, S | `{ method: cash|upi|card|bank_transfer|cheque, referenceNo?, subscriptionId }` or `{ memberId, planId }` or `{ eventId, memberId }` |
| GET | `/` | any (M sees own) | Query: `status` (`pending` = created+pending), `method`, `purpose`, `member`, `q` (receipt/Razorpay id), `from`, `to`. `meta` includes `gross`, `refunded`, `net`. |
| GET | `/:id` | owner, A, S | |
| GET | `/:id/receipt` | owner, A, S | PDF receipt (`application/pdf`) |
| POST | `/:id/refund` | A | `{ amount?, reason }` – full or partial; uses Razorpay Refund API for online payments |
| GET | `/transactions/ledger` | A | Query: `type` (credit/debit), `from`, `to` |
| POST | `/webhook` | Razorpay | Raw JSON; header `X-Razorpay-Signature`. Handles `payment.captured`, `order.paid`, `payment.failed`. |

## Attendance – `/attendance`
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/scan` | A, S | `{ code }` – `CLUBSPACE:<qrToken>` from the QR or a member ID; toggles check-in/out → `{ action, record, member }` |
| POST | `/check-in` | A, S | `{ memberId, notes? }` |
| POST | `/check-out` | A, S | `{ memberId }` |
| GET | `/` | any (M sees own) | Query: `date` (YYYY-MM-DD) or `from`/`to`, `member`, `inside=true` |
| GET | `/summary` | A, S | today's count, inside now, last 7 days |

## Events – `/events`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/` | any | Query: `upcoming=true`, `status`, `q`. Members get `myRegistration`; participants hidden. |
| GET | `/:id` | any | staff see `participants` |
| POST | `/` | A | multipart: `title, startDate, endDate, description?, category?, venue?, registrationDeadline?, capacity?, fee?, membersOnly?, notifyMembers?, banner?` |
| PATCH | `/:id` | A | same; setting `status=cancelled` notifies participants |
| DELETE | `/:id` | A | not allowed with paid registrations |
| POST | `/:id/register` | M (self), A/S (`memberId`) | → `status: registered` (free) or `pending_payment` (paid; then `/payments/order` with `eventId`) |
| POST | `/:id/cancel-registration` | M (self, unpaid), A/S | `{ memberId? }` |
| PATCH | `/:id/participants/:participantId` | A, S | `{ status: registered|pending_payment|attended|cancelled }` |

## Notifications – `/notifications`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/` | any | own inbox; `unread=true`; `meta.unread` |
| PATCH | `/:id/read` | any | |
| PATCH | `/read-all` | any | |
| DELETE | `/:id` | any | |
| GET | `/sent` | A | delivery log of member notifications (email/WhatsApp status) |
| POST | `/broadcast` | A | `{ title, message, audience: all|active|expired|expiring, email?, whatsapp? }` |
| POST | `/run-reminders` | A | runs the daily job now → counts |

## Dashboard – `/dashboard`
| Method | Path | Role | Returns |
|---|---|---|---|
| GET | `/admin` | A | `cards` (members, active, expired, revenue, month revenue, pending payments/amount, new registrations, expiring, today's attendance, upcoming events), `monthlyRevenue[12]`, `membershipStatus`, `planMix`, `recentMembers`, `recentPayments` |
| GET | `/staff` | A, S | today's check-ins, inside now, expiring, pending, recent activity |
| GET | `/member` | M | member, daysLeft, visits, payments, pending subscription, upcoming events, plans |

## Reports – `/reports/:type`
Role: A. `type` = `summary` · `revenue` · `payments` · `members` · `subscriptions` · `attendance`.
Query: `period` = `daily` · `monthly` · `annual` · `custom`; `date` (reference day for daily/monthly/annual) or `from` & `to` (custom); `format` = `json` (default) · `xlsx` · `pdf`; optional filters `status`, `method`, `member`, `all=true` (members report without date filter).
JSON returns `{ title, subtitle, columns, rows, summary }`; xlsx/pdf return a file download.

## Users (admin & staff accounts) – `/users`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/` | A (staff only), SA (all) | `role`, `q` |
| POST | `/` | A → staff; SA → any | `{ name, email, password, role, phone? }` |
| PATCH | `/:id` | same | `{ name?, phone?, role?, isActive?, password? }` – can't deactivate yourself |
| DELETE | `/:id` | same | last super admin can't be deleted |

## Settings – `/settings`
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/public` | 🌐 | club name, tagline, logo, contact |
| GET | `/` | A | `{ settings, integrations: { email, whatsapp, cloudinary, razorpay, demoPayments } }` |
| PATCH | `/` | SA | multipart: club fields, `reminderDaysBefore` ("7,3,1"), `emailNotifications`, `whatsappNotifications`, `logo?` |

---

## Example: member buys a plan with Razorpay

```bash
TOKEN=...   # from /auth/login
curl -X POST $API/subscriptions -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"planId":"<planId>"}'
# → data.subscription._id

curl -X POST $API/payments/order -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"subscriptionId":"<subId>"}'
# → open Razorpay Checkout with data.keyId + data.order.id, then:

curl -X POST $API/payments/verify -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"paymentId":"<paymentId>","razorpay_order_id":"order_…","razorpay_payment_id":"pay_…","razorpay_signature":"…"}'
```
