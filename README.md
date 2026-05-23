# StockVault — Inventory Reservation System

A full-stack inventory and order-fulfillment platform built with Next.js 14+, featuring a **reservation system** that temporarily holds stock during checkout to prevent overselling. Reservations are either confirmed on payment or automatically released on timeout.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Redis](https://img.shields.io/badge/Upstash_Redis-red?logo=redis)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)

---

## 🎯 Features

- **Product Catalog** — Browse products with real-time stock availability per warehouse
- **Stock Reservation** — Temporarily hold inventory during checkout (10-minute window)
- **Concurrency Safety** — Row-level PostgreSQL locking (`SELECT ... FOR UPDATE`) prevents overselling
- **Idempotent APIs** — Retry-safe reservation and confirmation endpoints via Redis-cached responses
- **Live Countdown** — Client-side timer with automatic expiry handling
- **Lazy + Cron Expiry** — Dual strategy for releasing expired reservations
- **Dark Theme UI** — Premium glassmorphism design with micro-animations

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (end-to-end, zero `any` types) |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| ORM | Prisma |
| Cache/Lock | [Upstash Redis](https://upstash.com) |
| Validation | Zod (shared schemas) |
| Styling | Tailwind CSS v4 |
| Toast | Sonner |
| Deployment | Vercel |

---

## 📦 Local Setup

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database
- An [Upstash](https://upstash.com) Redis instance

### 1. Clone and install

```bash
git clone <repo-url>
cd inventory-reservation-system
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Neon Postgres
DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/inventory?sslmode=require"

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://xxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# Cron secret (protect /api/cron/* routes)
CRON_SECRET="your-random-secret"
```

### 3. Set up the database

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🗄 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token | ✅ |
| `CRON_SECRET` | Secret to authenticate Vercel cron jobs | ✅ (production) |

---

## 🏗 Data Model

```
Warehouse ──┐
             ├── Stock (productId + warehouseId unique)
Product ────┘

Reservation (productId, warehouseId, quantity, status, expiresAt)
```

- **Stock.total**: Total units in a warehouse
- **Stock.reserved**: Units currently held by pending reservations
- **Available**: `total - reserved`
- On **confirm**: both `total` and `reserved` decrement (permanently consuming stock)
- On **release/expiry**: only `reserved` decrements (returning stock to available pool)

---

## 🔗 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/products` | All products with available stock per warehouse |
| GET | `/api/warehouses` | All warehouses |
| POST | `/api/reservations` | Create a reservation (with row-level locking) |
| GET | `/api/reservations/:id` | Fetch reservation details (with lazy expiry check) |
| POST | `/api/reservations/:id/confirm` | Confirm a pending reservation |
| POST | `/api/reservations/:id/release` | Release/cancel a pending reservation |
| GET | `/api/cron/expire-reservations` | Batch-expire stale reservations (cron job) |

---

## 🔒 Concurrency Strategy

### The Problem
Two users click "Reserve" on the last unit of a product at the same time. Without protection, both requests read `available = 1`, both succeed, and we've oversold.

### The Solution: `SELECT ... FOR UPDATE`

```typescript
await prisma.$transaction(async (tx) => {
  // Acquire an exclusive row-level lock on the Stock row
  const stockRows = await tx.$queryRaw`
    SELECT * FROM "Stock"
    WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
    FOR UPDATE
  `;

  const stock = stockRows[0];
  const available = stock.total - stock.reserved;

  if (available < quantity) {
    throw new Error("NOT_ENOUGH_STOCK"); // → 409 response
  }

  // Only one transaction reaches here at a time for this row
  await tx.stock.update({
    where: { productId_warehouseId: { productId, warehouseId } },
    data: { reserved: { increment: quantity } },
  });

  return await tx.reservation.create({ ... });
});
```

**How it works:**
1. The first transaction executes `SELECT ... FOR UPDATE`, which acquires an **exclusive row-level lock** on the Stock row
2. The second transaction attempts the same query but **blocks** until the first transaction commits or rolls back
3. After the first transaction commits (incrementing `reserved`), the second transaction re-reads the row with the updated `reserved` count
4. If no stock remains, the second transaction throws `NOT_ENOUGH_STOCK` → `409 Conflict`

This is implemented at the PostgreSQL level, making it bulletproof regardless of application-layer concurrency.

---

## 🔄 Idempotency

### The Problem
Network issues cause a client to retry `POST /api/reservations`. Without idempotency, the retry creates a duplicate reservation.

### The Solution: Redis-Cached Responses

```
Client → POST /api/reservations (Idempotency-Key: "abc-123")
  │
  ├─ Check Redis: "idempotency:abc-123" exists?
  │   ├─ YES → Return cached response (no DB write)
  │   └─ NO  → Execute logic, cache response with 24h TTL
```

**Implementation:**
1. Client sends `Idempotency-Key` header with a unique value (e.g., UUID)
2. Server checks Redis for `idempotency:<key>`
3. If found: returns the cached response body and status code immediately
4. If not found: executes the full logic, then stores `{ status, body }` in Redis with 24-hour TTL
5. Subsequent retries with the same key get the cached response

Supported on:
- `POST /api/reservations`
- `POST /api/reservations/:id/confirm`

---

## ⏰ Expiry Mechanism

Reservations expire after **10 minutes**. Two complementary strategies ensure expired reservations are cleaned up:

### 1. Lazy Expiry (On Read)
Every time a reservation is read (via `GET /api/reservations/:id` or the confirm endpoint), the system checks:
```
if (status === "PENDING" && expiresAt < now) → release stock, set RELEASED
```
This provides **immediate consistency** for the user interacting with their reservation.

### 2. Cron Job (Background Batch)
A Vercel Cron Job runs every 5 minutes at `GET /api/cron/expire-reservations`:
- Queries all `PENDING` reservations where `expiresAt < now`
- Releases each one in an individual transaction (with row-level locking)
- Protected by `CRON_SECRET` environment variable

This catches reservations that no one reads (e.g., user closes the browser).

**Why both?** Lazy expiry handles the happy path (user returns to their page). Cron handles the sad path (user abandons checkout). Together, they guarantee no stock is permanently locked.

---

## 🚀 Deployment (Vercel)

1. Push to GitHub
2. Import into Vercel
3. Set environment variables in Vercel dashboard
4. Vercel automatically detects `vercel.json` cron configuration
5. Run `npx prisma migrate deploy` via Vercel build command or manually

**Build command override:**
```
npx prisma generate && npx prisma migrate deploy && npm run build
```

---

## 🤔 Trade-offs & Future Improvements

| Area | Current | With More Time |
|------|---------|---------------|
| **Stock Updates** | Polling on page load | WebSocket/SSE for live stock updates |
| **Multi-Warehouse** | Single warehouse per reservation | Cart system with multi-warehouse fulfillment |
| **Event History** | Direct state mutations | Event sourcing for full audit trail |
| **Lock Strategy** | Postgres row locks | Redis distributed locks (Redlock) for cross-region |
| **Testing** | Manual testing | Integration tests with `vitest` + `@testcontainers/postgresql` |
| **Rate Limiting** | None | Upstash Ratelimit on reservation creation |
| **Notifications** | Toast only | Email/SMS on confirmation and expiry warning |
| **Monitoring** | Console logs | Structured logging with Axiom/Datadog |
| **Search** | None | Full-text search with Postgres `tsvector` or Algolia |
| **Auth** | None | NextAuth.js with user-scoped reservations |

---

## 📁 Project Structure

```
├── prisma/
│   ├── schema.prisma          # Data model
│   └── seed.ts                # Seed script (3 warehouses, 5 products)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── products/       # GET products with stock
│   │   │   ├── warehouses/     # GET warehouses
│   │   │   ├── reservations/   # POST create reservation
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts    # GET single reservation
│   │   │   │       ├── confirm/    # POST confirm
│   │   │   │       └── release/    # POST release
│   │   │   └── cron/
│   │   │       └── expire-reservations/  # GET cron job
│   │   ├── reservations/
│   │   │   └── [id]/page.tsx   # Checkout page with countdown
│   │   ├── layout.tsx          # Root layout with navigation
│   │   ├── page.tsx            # Product listing page
│   │   └── globals.css         # Design system & animations
│   └── lib/
│       ├── prisma.ts           # Prisma client singleton
│       ├── redis.ts            # Upstash Redis client singleton
│       ├── schemas.ts          # Shared Zod validation schemas
│       ├── idempotency.ts      # Idempotency cache helper
│       └── expiry.ts           # Reservation expiry utilities
├── .env.example
├── vercel.json                 # Cron job configuration
└── README.md
```

---

## 📝 License

MIT
