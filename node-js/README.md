# Node.js Backend Integration

Minimal example: Node.js server with OpenTelemetry auto-instrumentation.

**Documentation:** [Node.js Integration Guide](https://docs.kopai.app/integration/node)

## Prerequisites

- Node.js 22+
- Kopai account ([sign up](https://kopai.app))

## Setup

1. Get your backend token from [kopai.app/settings](https://kopai.app/settings)

2. Set environment variables:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp.kopai.app"
   export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_TOKEN"
   export OTEL_SERVICE_NAME="my-node-service"
   ```

3. Install and run:
   ```bash
   npm install
   node --import ./instrumentation.mjs server.mjs
   ```

## Files

- `instrumentation.mjs` - OpenTelemetry SDK setup with auto-instrumentation
- `server.mjs` - Example Express server

## Learn More

- [Node.js Integration](https://docs.kopai.app/integration/node) - Full instrumentation guide
- [Sending Traces](https://docs.kopai.app/sending-traces) - OTLP endpoints and configuration
- [Authentication](https://docs.kopai.app/authentication) - Token management
