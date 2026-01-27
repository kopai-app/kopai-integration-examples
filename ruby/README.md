# Ruby OpenTelemetry Example

Minimal Sinatra application demonstrating OpenTelemetry instrumentation with all three signal types: traces, logs, and metrics.

This example uses direct OTLP HTTP/JSON export for all signals, which provides the most reliable cross-platform compatibility.

## Prerequisites

- Ruby 3.x
- Bundler
- Kopai backend running

## Setup

### 1. Start Kopai Backend

```bash
npx @kopai/app start
```

### 2. Set Environment Variables

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=ruby-example
```

### 3. Install Dependencies

Using Nix (recommended):

```bash
nix develop
bundle install
```

Or without Nix:

```bash
bundle install
```

### 4. Run the Application

```bash
ruby app.rb
```

## Test

```bash
curl http://localhost:3001/hello
```

Expected response:

```json
{ "message": "Hello from Ruby!" }
```

## Validate Telemetry

Check that traces, logs, and metrics are being received:

```bash
# Search traces for this service
npx @kopai/cli traces search --service ruby-example

# Search logs for this service
npx @kopai/cli logs search --service ruby-example

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

This example sends telemetry via OTLP HTTP/JSON directly rather than using the Ruby OpenTelemetry SDK's protobuf exporters. This approach ensures compatibility with all OTLP receivers.
