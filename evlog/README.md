# evlog + OTLP Integration

Wide event logging with [evlog](https://evlog.dev) draining to Kopai via OTLP. Demonstrates both server-side wide events (Hono) and browser-side event logging.

**Documentation:** [evlog.dev](https://evlog.dev) | [OTLP Adapter](https://evlog.dev/adapters/otlp)

## Prerequisites

- Node.js 22+
- Kopai backend running locally

## Setup

1. Start Kopai backend:
   ```bash
   npx @kopai/app start
   ```

2. Set environment variables:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   ```

3. Install and run:
   ```bash
   cd evlog
   npm install
   npm run build:client
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

## What This Demonstrates

Open http://localhost:3000 and interact with the mini store:

1. **Page loads** — `page_view` event + `products_loaded` (fetches `/api/products`, triggering a server-side wide event)
2. **Click "Add to cart"** — `add_to_cart` event with product details
3. **Enter email and click "Checkout"** — `checkout_started` event, then `payment_failed` structured error with why/fix fields shown in UI

### Wide Events

Each API request emits **one comprehensive event** instead of scattered log lines. The product catalog request includes business context (count, stock levels). The checkout request captures email presence and product ID.

### Structured Errors

The checkout endpoint throws an error with actionable context:

```json
{
  "message": "Payment failed",
  "why": "Card declined by issuer — insufficient funds",
  "fix": "Try a different payment method or contact your bank",
  "link": "https://docs.example.com/payments/declined"
}
```

### Browser + Server Events

Browser events are sent via `evlog/browser` drain to the server, then forwarded to OTLP (tagged `evlog.source: browser`). Server events drain directly via `evlog/otlp`.

## Validate Telemetry

```bash
# Server-side wide events
npx @kopai/cli logs search --service evlog-example --json

# Browser-side events
npx @kopai/cli logs search --service evlog-example-browser --json
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP HTTP endpoint |
| `NODE_ENV` | - | Set to `production` for JSON output |

## Files

- `src/server.ts` — Hono server with evlog wide event middleware, API routes, OTLP drain
- `src/client.ts` — Browser evlog with `createBrowserLogDrain`, built to `dist/client.js`

## Signals Emitted

| Signal | Source | Description |
|--------|--------|-------------|
| Log (Wide Event) | Server (`evlog-example`) | One event per API request with full context |
| Log (Wide Event) | Browser (`evlog-example-browser`) | User interaction events (page_view, add_to_cart, checkout) |

## Learn More

- [evlog Documentation](https://evlog.dev)
- [Wide Events Guide](https://evlog.dev/guide/wide-events)
- [Structured Errors](https://evlog.dev/guide/structured-errors)
- [OTLP Adapter](https://evlog.dev/adapters/otlp)
