# DevCon Demo App

Minimal distributed system: Next.js frontend (port 3000) + Express API (port 3001). No OpenTelemetry — agent adds it.

## Prerequisites

- Docker

## Quick start

```bash
docker compose up --build
```

Open http://localhost:3000 — shows a product page with an "Add to Cart" button. The Express API is also accessible directly at http://localhost:3001.

## Enable the bug (slow payment validation)

```bash
ENABLE_PAYMENT_VALIDATION=true docker compose up --build
```

"Add to Cart" will take ~2s due to a simulated degraded payment provider in the Express API.

## Traffic generator

With services running:

```bash
./traffic-generator.sh
```

Sends GET/POST requests to localhost:3000 every 2s. Waits for next-app to be healthy before starting. Pass a custom base URL as first arg.

## Connect Kopai

Run on host:

```bash
npx kopai start
```

After instrumentation, services export OTLP to `host.docker.internal:4318`.
