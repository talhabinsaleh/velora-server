# Velora — Salon & Spa Appointment Booking (Server)

REST API for **Velora**, a salon appointment booking platform. It serves salon services, stores appointment requests, enforces role permissions, creates Stripe Checkout sessions, records payments from verified Stripe webhooks and uploads images to ImgBB.

This repository is the **Express server**. The website lives in [velora-client](https://github.com/talhabinsaleh/velora-client).

- **Live website:** https://velora-talha.vercel.app
- **Live API:** https://velora-talha-server.vercel.app
- **Client repository:** https://github.com/talhabinsaleh/velora-client
- **Server repository:** https://github.com/talhabinsaleh/velora-server

## Important Features

- Express 5 + TypeScript, MongoDB with **Mongoose** models for `users` (shared with Better Auth), `services`, `appointments` and `transactions`, with references between them
- **JWT verification middleware** (`verifyJWT`) on every protected route, plus **server-side role checks** (`verifyAdmin`, `verifyCustomer`). The role and blocked flag are read fresh from the database on each request
- Blocked users get `403` everywhere and their sessions are removed when they are blocked
- Public service listing returns **active services only**, with search by name, category filter, **sorting by price** and pagination
- Appointment rules: customers only, active services only, no past dates or slots, **no duplicate active booking** for the same service, date and time slot (enforced by a partial unique index), customers cancel only their own *pending* requests, admins confirm only *pending* ones
- Stripe Checkout for confirmed, unpaid appointments. **The payment status changes only in the signature-verified webhook** (`checkout.session.completed`), which also writes the transaction. There is no route to edit transactions
- Profile updates accept only `name`, `image` and `phone`, so users can't change their own role or blocked status, or anyone else's profile
- ImgBB upload proxy (the API key never reaches the browser) with type and size checks and rate limiting
- Central error handler with clear messages for validation errors, bad IDs, conflicts and unknown routes

## Technology Stack

Node.js · Express 5 · TypeScript · MongoDB · Mongoose 9 · jsonwebtoken · Stripe · Multer + ImgBB · cookie-parser · CORS · Vercel (serverless)

## Installation

```bash
git clone https://github.com/talhabinsaleh/velora-server.git
cd velora-server
npm install
cp .env.example .env   # then fill in the values
```

## How to Run the Project Locally

```bash
npm run dev        # http://localhost:5000 (watches for changes)
```

Seed demo data (the client must be running so accounts are created through Better Auth):

```bash
npm run seed              # adds services and sample requests if empty
npm run seed -- --reset   # replaces services and appointments
npm run make-admin -- someone@example.com   # give an existing account admin access
```

To test Stripe webhooks locally: `stripe listen --forward-to localhost:5000/api/payments/webhook` and use the printed signing secret as `STRIPE_WEBHOOK_SECRET`.

Other scripts: `npm run build`, `npm start`, `npm run typecheck`.

## Required Environment Variables

Names only, never commit real values:

```
MONGODB_URI
DB_NAME
JWT_SECRET
CLIENT_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CURRENCY
IMGBB_API_KEY
PORT
SEED_ADMIN_EMAIL        (seed script only)
SEED_ADMIN_PASSWORD     (seed script only)
SEED_CUSTOMER_EMAIL     (seed script only)
SEED_CUSTOMER_PASSWORD  (seed script only)
```

`JWT_SECRET` must match the client. `CLIENT_URL` is the website address (comma separate several), used for CORS and Stripe redirects.

## API Overview

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/services` (`search`, `category`, `sort=price_asc\|price_desc\|newest`, `page`, `limit`) | Public |
| GET | `/api/services/featured`, `/api/services/categories`, `/api/services/meta`, `/api/services/:id` | Public |
| GET | `/api/appointments/availability?serviceId&date` | Signed in |
| POST | `/api/appointments` | Customer |
| GET | `/api/appointments/mine`, `/api/appointments/stats`, `/api/appointments/:id` | Customer (own) |
| PATCH | `/api/appointments/:id/cancel` | Customer (own, pending) |
| POST | `/api/payments/checkout` | Customer (own, confirmed, unpaid) |
| GET | `/api/payments/session/:sessionId`, `/api/payments/history` | Customer (own) |
| POST | `/api/payments/webhook` | Stripe (signature verified) |
| GET / PATCH | `/api/profile` | Signed in (own profile) |
| POST | `/api/upload` | Rate limited |
| GET / POST / PATCH / DELETE | `/api/admin/services[/:id][/status]` | Admin |
| GET / PATCH | `/api/admin/appointments[/:id][/confirm\|/cancel]` | Admin |
| GET / PATCH | `/api/admin/users[/:id][/block\|/unblock]` | Admin |
| GET | `/api/admin/stats`, `/api/admin/transactions` | Admin |

## Data Model

- **users** (Better Auth): name, email, image, role, isBlocked, phone
- **services**: serviceName, category, description, price, duration, image, status, createdAt
- **appointments**: serviceId → services, customerId → users, appointmentDate, timeSlot, message, servicePrice, paymentStatus, status, createdAt
- **transactions**: appointmentId → appointments, customerId → users, amount, currency, stripeSessionId, status, createdAt
