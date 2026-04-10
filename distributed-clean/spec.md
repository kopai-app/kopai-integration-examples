# DevCon Demo App — Technical Spec

## Purpose

A minimal distributed system used in two asciinema recordings for an AI Native DevCon Spring 2026 CFP lightning talk submission. The recordings demonstrate:

1. **Instrumentation loop** — AI agent instruments the app with OpenTelemetry
2. **RCA loop** — AI agent debugs a latency issue using traces

## Architecture

```
                    ┌─────────────────────┐
                    │   host browser      │
                    │   localhost:3000     │
                    └────────┬────────────┘
                             │
              ┌──────────────▼──────────────┐
              │       next-app:3000         │
              │    Next.js 14+ App Router   │
              │    SSR + Client Components  │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     express-api:3001        │
              │    Products + Cart API      │
              │    Payment validation       │
              │    (behind feature flag)    │
              └─────────────────────────────┘

              ┌─────────────────────────────┐
              │    traffic-generator        │
              │    curl loop every 2s       │
              │    hits next-app endpoints  │
              └─────────────────────────────┘
```

## Services

### 1. next-app (Next.js, port 3000)

**Server Component — Product Page (`app/products/[id]/page.tsx`)**

- Fetches `GET http://express-api:3001/products/:id`
- Renders product name, price, stock count
- Server-side rendered

**Client Component — AddToCart (`components/AddToCart.tsx`)**

- "Add to Cart" button
- Calls `POST /api/cart` (Next.js API route)
- Shows loading state and success/error

**API Route (`app/api/cart/route.ts`)**

- Receives `{ productId, quantity }` from client
- Proxies to `POST http://express-api:3001/cart`
- Returns response to client

**Tech:**

- Next.js 14+ with App Router
- TypeScript
- No styling library — minimal inline styles or Tailwind, just enough to look like a real page

### 2. express-api (Express, port 3001)

**`GET /products/:id`**

- Returns product from hardcoded array
- Response: `{ id, name, price, stock }`
- Always fast (~5ms)

**`POST /cart`**

- Receives `{ productId, quantity }`
- Checks stock availability
- If `ENABLE_PAYMENT_VALIDATION=true`: calls `validatePayment()` which simulates a degraded payment provider (~2000ms)
- Adds item to in-memory cart array
- Response: `{ success: true, cartId }`

**`GET /cart`**

- Returns current cart contents
- Useful for traffic generator to exercise more endpoints

**Product data (hardcoded):**

```json
[
  { "id": 1, "name": "Mechanical Keyboard", "price": 149.99, "stock": 25 },
  { "id": 2, "name": "USB-C Hub", "price": 59.99, "stock": 12 },
  { "id": 3, "name": "Monitor Stand", "price": 89.99, "stock": 8 }
]
```

**Feature flag:**

- `ENABLE_PAYMENT_VALIDATION` env var, default `false`
- When `true`, `POST /cart` calls `validatePayment()` which has a 2-second delay simulating a degraded external payment provider
- The function should create a span named `payment.validate` so it's visible in traces after instrumentation

**Tech:**

- Express 4
- Plain JavaScript (simpler for the agent to instrument)
- No database — in-memory arrays

### 3. traffic-generator

**Behavior:**

- Loops every 2 seconds
- Each iteration:
  - `GET /products/1`
  - `GET /products/2`
  - `POST /cart { productId: 1, quantity: 1 }`
  - `POST /cart { productId: 2, quantity: 3 }`
- Targets `http://next-app:3000` (goes through Next.js, not directly to Express)

**Tech:**

- Shell script with `curl`
- Alpine-based Docker image (minimal)
- Waits for next-app to be healthy before starting

## Docker Compose

**`docker-compose.yml`:**

- Three services: `next-app`, `express-api`, `traffic-generator`
- Each builds from its own `Dockerfile` in its directory
- `next-app` depends on `express-api`
- `traffic-generator` depends on `next-app`
- Port mapping: `3000:3000` (next-app), `3001:3001` (express-api)
- `ENABLE_PAYMENT_VALIDATION` passed to `express-api`, default `false`

**Single command:** `docker compose up --build`

**Bug mode:** `ENABLE_PAYMENT_VALIDATION=true docker compose up --build`

## OpenTelemetry — Deliberately Absent

The app ships with **zero OpenTelemetry instrumentation**. No SDK, no `instrumentation.ts`, no tracing setup. This is intentional — the agent adds it during the instrumentation recording.

However, the app needs to be structured so that instrumentation is straightforward:

- Express app uses standard `express()` pattern (auto-instrumentable)
- Next.js uses standard App Router (compatible with `@vercel/otel` or manual setup)
- HTTP calls use `fetch` (auto-instrumentable by OTel Node SDK)

## OTLP Export Target

After instrumentation, services should export OTLP to `host.docker.internal:4318` (HTTP) where `@kopai/app` runs on the host machine via `npx kopai start`.

The agent will configure this during the instrumentation recording. The app itself should not have any OTLP configuration pre-baked.

## File Structure

```
demos/devcon-next-express/
├── docker-compose.yml
├── README.md
├── next-app/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx                    # redirects to /products/1
│       ├── products/
│       │   └── [id]/
│       │       └── page.tsx            # Server Component — product page
│       └── api/
│           └── cart/
│               └── route.ts           # API route — proxies to Express
│   └── components/
│       └── AddToCart.tsx               # Client Component
├── express-api/
│   ├── Dockerfile
│   ├── package.json
│   └── index.js                       # All routes + simulated payment
└── traffic-generator/
    ├── Dockerfile
    └── generate.sh                    # curl loop
```

## README Contents

1. **Prerequisites:** Docker, Node.js (for running kopai on host)
2. **Quick start:** `docker compose up --build`
3. **Test in browser:** Open `http://localhost:3000`
4. **Enable the bug:** `ENABLE_PAYMENT_VALIDATION=true docker compose up`
5. **Connect Kopai:** `npx kopai start` on host — services export OTLP to it after instrumentation
6. **For recording:** Step-by-step instructions for both asciinema recordings

## Recording Flow (Context for Recordings, Not Part of the App)

### Recording 1 — Instrumentation (feature flag OFF)

1. `docker compose up --build` — all services running, no OTel
2. Show browser at `localhost:3000` — product page works, cart works, everything fast
3. `npx tessl i kopai/otel-instrumentation`
4. Agent instruments Next.js (creates `instrumentation.ts`, adds OTel SDK)
5. Agent instruments Express (adds `@opentelemetry/sdk-node`, wraps app)
6. Agent configures OTLP export to `host.docker.internal:4318`
7. Agent verifies via `kopai traces` — traces visible across all layers
8. Cut/speed up: npm installs, agent thinking, Next.js recompilation

### Recording 2 — RCA (feature flag ON)

1. `ENABLE_PAYMENT_VALIDATION=true docker compose up` — services running, instrumented, bug active
2. Show browser — "Add to Cart" is slow (~2s)
3. `npx tessl i kopai/root-cause-analysis`
4. Agent runs `kopai traces` / `kopai logs` to find the slow spans
5. Agent identifies `payment.validate` span at 2000ms inside `POST /cart`
6. Agent presents root cause: payment provider is degraded
7. Cut/speed up: agent thinking

## What This Does NOT Include

- No OpenTelemetry (agent adds it)
- No Kopai integration (agent adds it)
- No real database
- No authentication
- No production concerns (error handling, validation beyond basics)
- No tests
