# Next.js + Manual OpenTelemetry SDK Integration

Next.js App Router with manual OpenTelemetry SDK — server-side and client-side instrumentation with distributed tracing across both.

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
   export OTEL_SERVICE_NAME="server-side"
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

| Signal         | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| Server traces  | HTTP spans via @opentelemetry/sdk-node                       |
| Browser traces | Page load + fetch spans via @opentelemetry/sdk-trace-web     |

Browser fetch calls inject `traceparent` headers, so server spans appear as children of browser spans — creating end-to-end distributed traces.

## Files

- `src/instrumentation.ts` — Runtime check + dynamic import
- `src/instrumentation.node.ts` — NodeSDK + OTLPTraceExporter setup (server)
- `src/app/otel-provider.tsx` — Browser OTel initialization (client)
- `src/app/api/otel/route.ts` — OTLP proxy (browser → collector)
- `src/app/api/surveys/route.ts` — Survey CRUD API
- `src/app/api/stats/route.ts` — Survey statistics API

## Learn More

- [Next.js OpenTelemetry Guide](https://nextjs.org/docs/app/guides/open-telemetry) — official docs this example is based on
- [@opentelemetry/sdk-node](https://www.npmjs.com/package/@opentelemetry/sdk-node)
