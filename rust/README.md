# Rust OpenTelemetry Example

Minimal Axum application demonstrating OpenTelemetry instrumentation with all three signal types: traces, logs, and metrics.

This example uses direct OTLP HTTP/JSON export for simplicity and compatibility.

## Prerequisites

- Rust 1.70+
- Cargo
- Kopai backend running

## Setup

### 1. Start Kopai Backend

```bash
npx @kopai/app start
```

### 2. Set Environment Variables

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=rust-example
```

### 3. Build and Run

Using Nix (recommended):

```bash
nix develop
cargo run --release
```

Or without Nix:

```bash
cargo run --release
```

Note: First build may take a few minutes to compile dependencies.

## Test

```bash
curl http://localhost:3001/hello
```

Expected response:

```json
{ "message": "Hello from Rust!" }
```

## Validate Telemetry

Check that traces, logs, and metrics are being received:

```bash
# Search traces for this service
npx @kopai/cli traces search --service rust-example

# Search logs for this service
npx @kopai/cli logs search --service rust-example

# Discover metrics
npx @kopai/cli metrics discover
```

## Signals Emitted

| Signal | Name             | Description                |
| ------ | ---------------- | -------------------------- |
| Trace  | GET /hello       | Manual span via OTLP JSON  |
| Metric | `hello.requests` | Counter of hello requests  |
| Log    | INFO level       | "Hello endpoint called"    |

## Notes

This example sends telemetry via OTLP HTTP/JSON directly. For production use with the OpenTelemetry Rust SDK:

```toml
[dependencies]
opentelemetry = "0.21"
opentelemetry_sdk = "0.21"
opentelemetry-otlp = "0.14"
```
