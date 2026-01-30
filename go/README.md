# Go OpenTelemetry Example

Minimal HTTP server demonstrating OpenTelemetry instrumentation with all three signal types: traces, logs, and metrics.

## Prerequisites

- Go 1.22+
- Kopai backend running

## Setup

### 1. Start Kopai Backend

```bash
npx @kopai/app start
```

### 2. Set Environment Variables

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=go-example
```

### 3. Install Dependencies

Using Nix (recommended):

```bash
nix develop
go mod tidy
```

Or without Nix:

```bash
go mod tidy
```

### 4. Run the Application

```bash
go run main.go
```

## Test

```bash
curl http://localhost:3001/hello
```

Expected response:

```json
{ "message": "Hello from Go!" }
```

## Validate Telemetry

Check that traces, logs, and metrics are being received:

```bash
# List recent traces
npx @kopai/cli traces search

# List recent logs
npx @kopai/cli logs search

# List metrics
npx @kopai/cli metrics discover
```

## Signals Emitted

| Signal | Name             | Description               |
| ------ | ---------------- | ------------------------- |
| Trace  | `hello-handler`  | Span for /hello endpoint  |
| Metric | `hello.requests` | Counter of hello requests |
| Log    | INFO level       | "Hello endpoint called"   |
