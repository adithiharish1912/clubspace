# Testing

## 1. Automated API tests (55 tests)

`backend/tests/api.test.js` drives the real Express app over HTTP (Supertest + Node's built-in test runner) against a real MongoDB. It **drops the test database** before and after, so always point it at a throw-away database.

```bash
cd backend
TEST_MONGO_URI=mongodb://127.0.0.1:27017/clubspace_test npm test
# Windows PowerShell:
# $env:TEST_MONGO_URI="mongodb://127.0.0.1:27017/clubspace_test"; npm test
```

Expected result:

```
# tests 55
# pass 55
# fail 0
```

What's covered:

| Area | Tests |
|---|---|
| Registration | validation errors, membership ID format, duplicate email (409) |
| Login / auth | login, wrong password, missing token (401), NoSQL-injection attempt, email verification |
| Password reset | reset link, unknown email returns same response, **old JWT revoked after reset** |
| Admin permissions | super admin creates admin/staff; admin can't create admin; member can't list members; staff can't create plans, refund, read reports or admin dashboard; deactivated user blocked |
| Plans | custom plan, deactivate, members only see active plans |
| Member creation | staff creates member + login + pending plan; search & filter |
| Payment processing | order (amount in paise incl. 18 % GST), demo checkout, membership activation, **idempotent completion**, forged signature rejected, HMAC verification unit test, cross-member payment blocked, cash payment, PDF receipt |
| Membership renewal | early renewal stacks days (+30), history endpoint |
| Refunds | staff blocked, full refund cancels membership + ledger debit, partial refund, over-refund rejected |
| Attendance | QR generation, QR scan check-in → second scan check-out, manual check-in/out, duplicate check-in blocked, expired member refused, daily list & summary, member sees own |
| Events | create free/paid, invalid dates (422), capacity, duplicate registration (409), paid event → payment → registered, participant privacy |
| Notifications | inbox, unread count, mark all read, broadcast |
| Scheduler | members expired by job; reminders sent once (no duplicates) |
| Reports | all 6 report types as JSON, **Excel** (.xlsx signature) and **PDF** (%PDF signature) |
| Dashboards | admin cards & 12-month chart, member, staff |
| Settings | admin read-only, super admin update, public endpoint |

## 2. Manual QA checklist (browser)

Seed demo data first: `npm run seed -- --demo`.

**Authentication**
- [ ] Register a new member → lands on *My Membership*; verification banner shows; link in console (dev) verifies email
- [ ] Log out / log in; wrong password shows an error
- [ ] Forgot password → reset link → old session is logged out, new password works

**Member journey (use a phone or DevTools mobile view)**
- [ ] Choose a plan → checkout (demo or Razorpay test mode) → card shows *Active*, expiry updated, receipt email/console, notification bell shows 1
- [ ] Renew before expiry → expiry extends from the old expiry date
- [ ] Download PDF receipt from *My Payments*
- [ ] Open QR on the membership card; register for a free event and a paid event

**Staff**
- [ ] *Members → New member* with a plan; collect cash payment → receipt number shown
- [ ] *Attendance*: scan the member's QR with the camera (or type the ID) → check-in; scan again → check-out
- [ ] An expired/pending member is refused entry
- [ ] Staff cannot open `/reports`, `/plans`, `/users` (redirects to dashboard)

**Admin**
- [ ] Dashboard cards and charts populate; clicking a card opens the filtered list
- [ ] Create/edit/deactivate a plan
- [ ] Refund a payment (full and partial); member status updates after full refund
- [ ] Create an event with banner and *Notify members*; cancel it → participants notified
- [ ] Reports: switch type/period; export Excel and PDF
- [ ] Send an announcement; check *Sent to members* log
- [ ] *Run reminders* button reports counts
- [ ] Dark mode toggle; resize to phone width — sidebar becomes a drawer, tables scroll horizontally

**Razorpay test mode** (with `rzp_test_…` keys): use card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`, or UPI `success@razorpay`. Verify the payment appears in the Razorpay dashboard and the webhook delivery shows 200.

## 3. Browser smoke test

The build was also checked end-to-end in headless Chrome (admin, staff, member on a 390 px phone viewport, super admin): every page loads without JavaScript errors, the demo checkout renews a membership, manual check-in works and staff are redirected away from admin-only pages.
