# Database design (MongoDB / Mongoose)

All collections have `createdAt` / `updatedAt` timestamps. Source: `backend/src/models/`.

```
User 1───0..1 Member 1───* Subscription *───1 MembershipPlan
                 │  1            │ 0..1
                 │               ▼
                 ├────────* Payment 1───* Transaction
                 │            │ 0..1
                 ├────────* Attendance
                 ├────────* Notification *───0..1 User
                 └──* Event.participants[] (embedded)
Setting (singleton)
```

## users
| Field | Type | Notes |
|---|---|---|
| name | String | required, ≤100 |
| email | String | **unique**, lowercase, validated |
| phone | String | |
| password | String | bcrypt hash, `select:false` |
| role | enum | `superadmin` · `admin` · `staff` · `member` (indexed) |
| avatar | {url, publicId} | Cloudinary |
| isActive | Boolean | deactivated users can't log in |
| isEmailVerified | Boolean | |
| emailVerifyToken / emailVerifyExpires | String / Date | SHA-256 hash, 24 h |
| resetPasswordToken / resetPasswordExpires | String / Date | SHA-256 hash, 30 min |
| passwordChangedAt, tokenVersion | Date, Number | token revocation |
| lastLoginAt | Date | |

## members
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → users | optional (walk-in members may have no login); unique sparse |
| membershipId | String | **unique**, e.g. `CS-2026-00042` (per-year counter) |
| firstName, lastName | String | |
| email, phone | String | required; email indexed |
| gender, dateOfBirth, occupation | | |
| address | {line1, city, state, pincode} | |
| emergencyContact | {name, phone, relation} | |
| photo | {url, publicId} | |
| status | enum | `pending` · `active` · `expired` · `suspended` · `cancelled` (indexed) |
| currentSubscription | ObjectId → subscriptions | |
| membershipExpiry | Date | indexed – drives reminders & entry checks |
| joinedAt | Date | |
| qrToken | String | **unique**, random 128-bit, encoded in the QR |
| notes | String | ≤1000 |
| createdBy | ObjectId → users | |

Indexes: text index (names, email, ID, phone), `createdAt`.

## membershipplans
| Field | Type | Notes |
|---|---|---|
| name | String | |
| code | String | **unique**, upper-case |
| description | String | |
| durationType | enum | `monthly` · `quarterly` · `half-yearly` · `annual` · `custom` |
| durationDays | Number | defaults 30/90/180/365, 1–3650 |
| price | Number | before tax |
| taxPercent | Number | e.g. 18 (GST) |
| features | [String] | |
| isPremium, isActive | Boolean | |
| color, sortOrder | | display |
| *virtual* totalPrice | | price × (1 + tax) |

## subscriptions
| Field | Type | Notes |
|---|---|---|
| member | ObjectId → members | indexed |
| plan | ObjectId → membershipplans | |
| planSnapshot | {name, code, durationType, durationDays, price, taxPercent} | history unaffected by later plan edits |
| type | enum | `new` · `renewal` |
| amount | Number | incl. tax |
| startDate, endDate | Date | set on activation |
| status | enum | `pending` · `active` · `expired` · `cancelled` |
| payment | ObjectId → payments | |
| remindersSent | [Number] | days-before values already notified |
| createdBy, cancelledReason | | |

Indexes: `{member, createdAt}`, `{status, endDate}`.

## payments
| Field | Type | Notes |
|---|---|---|
| receiptNo | String | unique sparse, `RCPT-2026-000123` |
| member | ObjectId → members | indexed |
| subscription / event | ObjectId | what was paid for |
| purpose | enum | `membership` · `event` · `other` |
| description, amount, currency | | |
| method | enum | `razorpay` · `cash` · `upi` · `card` · `bank_transfer` · `cheque` · `demo` |
| status | enum | `created` · `pending` · `paid` · `failed` · `refunded` · `partially_refunded` |
| razorpayOrderId, razorpayPaymentId | String | indexed |
| razorpaySignature | String | `select:false` |
| referenceNo | String | UPI txn / cheque no. |
| refundedAmount | Number | |
| refunds[] | {amount, reason, razorpayRefundId, status, processedBy, processedAt} | |
| paidAt | Date | indexed |
| failureReason, recordedBy | | |

## transactions (ledger, append-only)
| Field | Type | Notes |
|---|---|---|
| payment | ObjectId → payments | |
| member | ObjectId → members | |
| type | enum | `credit` (money in) · `debit` (refund) |
| category | enum | `membership` · `event` · `refund` · `other` |
| amount, method, reference, description | | |
| performedBy | ObjectId → users | |

## attendances
| Field | Type | Notes |
|---|---|---|
| member | ObjectId → members | |
| date | String `YYYY-MM-DD` | local club day |
| checkIn, checkOut | Date | |
| durationMinutes | Number | |
| method | enum | `qr` · `manual` · `self` |
| markedBy, notes | | |

Indexes: `{date, member}`, `{member, checkIn}`.

## events
| Field | Type | Notes |
|---|---|---|
| title, description, category, venue | | |
| startDate, endDate, registrationDeadline | Date | end ≥ start validated |
| capacity | Number | 0 = unlimited |
| fee | Number | 0 = free |
| banner | {url, publicId} | |
| status | enum | `upcoming` · `ongoing` · `completed` · `cancelled` |
| membersOnly | Boolean | requires active membership |
| participants[] | {member, status, payment, registeredAt} | status `registered` · `pending_payment` · `attended` · `cancelled` |
| *virtual* registeredCount | | |

## notifications
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → users | in-app recipient |
| member | ObjectId → members | |
| type | enum | `expiry_reminder`, `renewal_reminder`, `membership_expired`, `payment_confirmation`, `payment_refund`, `event`, `welcome`, `announcement`, `system` |
| title, message, link | | |
| channels | {inApp, email.status, whatsapp.status} | status `sent` · `logged` · `failed` · `skipped` |
| isRead, readAt | | |

## settings (single document, key = "global")
clubName, tagline, logo, email, phone, address, website, gstNumber, currency, membershipIdPrefix, receiptPrefix, reminderDaysBefore `[7,3,1]`, emailNotifications, whatsappNotifications, openingTime, closingTime, and internal per-year `counters` for member IDs and receipts (incremented atomically with `$inc`).
