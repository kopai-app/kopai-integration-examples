# Elixir/Erlang OpenTelemetry Example

Minimal Elixir application using Plug demonstrating OpenTelemetry instrumentation with all three signal types: traces, logs, and metrics.

This example uses direct OTLP HTTP/JSON export for simplicity and compatibility.

## Prerequisites

- Elixir 1.14+
- Erlang/OTP 25+
- Kopai backend running

## Setup

### 1. Start Kopai Backend

```bash
npx @kopai/app start
```

### 2. Set Environment Variables

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=elixir-example
```

### 3. Install Dependencies

Using Nix (recommended):

```bash
nix develop
mix deps.get
```

Or without Nix:

```bash
mix deps.get
```

### 4. Run the Application

```bash
mix run --no-halt
```

## Test

```bash
curl http://localhost:3001/hello
```

Expected response:

```json
{ "message": "Hello from Elixir!" }
```

## Validate Telemetry

Check that traces, logs, and metrics are being received:

```bash
# Search traces for this service
npx @kopai/cli traces search --service elixir-example

# Search logs for this service
npx @kopai/cli logs search --service elixir-example

# Discover metrics
npx @kopai/cli metrics discover
```

## Signals Emitted

| Signal | Name             | Description                |
| ------ | ---------------- | -------------------------- |
| Trace  | GET /hello       | Manual span via OTLP JSON  |
| Metric | `hello.requests` | Counter of hello requests  |
| Log    | INFO level       | "Hello endpoint called"    |

## Using OpenTelemetry SDK

For production use with the OpenTelemetry Elixir SDK:

```elixir
# mix.exs
defp deps do
  [
    {:opentelemetry, "~> 1.0"},
    {:opentelemetry_exporter, "~> 1.0"}
  ]
end
```

```elixir
# config/runtime.exs
config :opentelemetry,
  span_processor: :batch,
  traces_exporter: :otlp

config :opentelemetry_exporter,
  otlp_protocol: :http_protobuf,
  otlp_endpoint: System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT")
```
