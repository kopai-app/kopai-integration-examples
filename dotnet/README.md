# .NET OpenTelemetry Example

Minimal ASP.NET Core application demonstrating OpenTelemetry instrumentation with all three signal types: traces, logs, and metrics.

## Prerequisites

- .NET 8.0 SDK
- Kopai backend running

## Setup

### 1. Start Kopai Backend

```bash
npx @kopai/app start
```

### 2. Set Environment Variables

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=dotnet-example
```

### 3. Install Dependencies

Using Nix (recommended):

```bash
nix develop
dotnet restore
```

Or without Nix:

```bash
dotnet restore
```

### 4. Run the Application

```bash
dotnet run
```

## Test

```bash
curl http://localhost:3001/hello
```

Expected response:

```json
{ "message": "Hello from .NET!" }
```

## Validate Telemetry

Check that traces, logs, and metrics are being received:

```bash
# Search traces for this service
npx @kopai/cli traces search --service dotnet-example

# Search logs for this service
npx @kopai/cli logs search --service dotnet-example

# Discover metrics
npx @kopai/cli metrics discover
```

## Signals Emitted

| Signal | Name             | Description                            |
| ------ | ---------------- | -------------------------------------- |
| Trace  | HTTP GET /hello  | Auto-instrumented ASP.NET Core span    |
| Metric | `hello.requests` | Counter of hello requests              |
| Log    | INFO level       | "Hello endpoint called"                |
