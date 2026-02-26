# Next.js + @vercel/otel Integration

Minimal example: Next.js App Router with OpenTelemetry via `@vercel/otel`.

## Prerequisites

- Node.js 22+
- pnpm

## Setup

1. Start the Kopai backend locally:
   ```bash
   npx @kopai/app start
   ```

2. Set environment variables:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
   ```

3. Install and run:
   ```bash
   pnpm install
   pnpm dev
   ```

## Generate Traffic

Open [http://localhost:3000](http://localhost:3000) in your browser and use the survey app — submit forms, browse the list, check stats. Each interaction generates telemetry.

## Validate Telemetry

### Via CLI

```bash
npx @kopai/cli traces search
npx @kopai/cli traces get <trace-id>
```

### Via Dashboard

Open the Kopai dashboard at `http://localhost:3579` (started by `npx @kopai/app start`) to visually inspect traces, spans, and service topology.

## Signals Emitted

| Signal | Description                  |
| ------ | ---------------------------- |
| Traces | HTTP spans via @vercel/otel   |

## Files

- `src/instrumentation.ts` — `registerOTel()` setup
- `src/app/api/surveys/route.ts` — Survey CRUD API
- `src/app/api/stats/route.ts` — Survey statistics API

## Learn More

- [Next.js OpenTelemetry Guide](https://nextjs.org/docs/app/guides/open-telemetry) — official docs this example is based on
- [@vercel/otel](https://www.npmjs.com/package/@vercel/otel)
