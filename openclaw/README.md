# OpenClaw Integration

AI agent observability with [OpenClaw](https://openclaw.ai) and [Kopai](https://kopai.app). Sends gateway traces, structured logs, and metrics to Kopai via the built-in `@openclaw/diagnostics-otel` plugin.

**Documentation:** [OpenClaw OpenTelemetry](https://docs.openclaw.ai/gateway/opentelemetry)

## Prerequisites

- OpenClaw installed (`npm install -g openclaw@latest`, Node 24 or 22.14+)
- Kopai running locally

## Setup

1. Start Kopai backend:

   ```bash
   npx @kopai/app start
   ```

2. Install the diagnostics plugin:

   ```bash
   openclaw plugins install clawhub:@openclaw/diagnostics-otel
   ```

3. Enable the OTel exporter in `~/.openclaw/openclaw.json`:

   ```bash
   openclaw config set diagnostics.enabled true
   openclaw config set diagnostics.otel.enabled true
   openclaw config set diagnostics.otel.logs true
   ```

   Or edit `~/.openclaw/openclaw.json` directly to add:

   ```json
   "diagnostics": {
     "enabled": true,
     "otel": {
       "enabled": true,
       "logs": true
     }
   }
   ```

4. Set the OTLP endpoint (the gateway picks this up on next start):

   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   export OTEL_SERVICE_NAME=openclaw-gateway
   ```

5. Start (or restart) the gateway:

   ```bash
   openclaw gateway stop
   openclaw gateway --allow-unconfigured
   ```

   The gateway will log `diagnostics-otel: logs exporter enabled (OTLP/Protobuf)` to confirm.

6. Run an agent turn to generate telemetry:

   ```bash
   openclaw agent --agent main --message "Hello"
   ```

## What It Captures

- **Traces** — gateway lifecycle phases and diagnostic spans
- **Logs** — structured gateway activity (agent turns, model calls, warnings)
- **Metrics** — telemetry exporter events

Note: raw prompt/response content is not exported by default (privacy-by-default). To enable content capture, set `diagnostics.otel.captureContent.*` options in `~/.openclaw/openclaw.json`.

## Validating Telemetry

```bash
# Search traces
npx @kopai/cli traces search --service openclaw-gateway --json

# Search logs — agent turns, model calls, warnings
npx @kopai/cli logs search --service openclaw-gateway --json

# Discover metrics
npx @kopai/cli metrics discover --json
```

## Sending to Kopai.app in the Cloud

Add the cloud endpoint and your backend token to `~/.openclaw/openclaw.json`:

```json
"diagnostics": {
  "enabled": true,
  "otel": {
    "enabled": true,
    "logs": true,
    "endpoint": "https://otlp-http.kopai.app",
    "headers": {
      "Authorization": "Bearer YOUR_BACKEND_TOKEN"
    }
  }
}
```

Get your backend token at [kopai.app](https://kopai.app) under **Settings → Access Tokens**.

## Learn More

- [OpenClaw OTel Docs](https://docs.openclaw.ai/gateway/opentelemetry) — plugin config reference
- [Kopai CLI](https://github.com/kopai-app/kopai-mono/tree/main/packages/cli) — query telemetry data
- [OpenTelemetry Docs](https://opentelemetry.io/docs/) — OTel reference
