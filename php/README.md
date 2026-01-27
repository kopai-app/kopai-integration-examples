# PHP OpenTelemetry Example

Minimal PHP application demonstrating OpenTelemetry instrumentation with all three signal types: traces, logs, and metrics.

This example uses direct OTLP HTTP/JSON export, which provides reliable cross-platform compatibility without requiring Composer dependencies.

## Prerequisites

- PHP 8.x with curl extension
- Kopai backend running

## Setup

### 1. Start Kopai Backend

```bash
npx @kopai/app start
```

### 2. Set Environment Variables

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=php-example
```

### 3. Run the Application

Using Nix (recommended):

```bash
nix develop
php -S 0.0.0.0:3001
```

Or without Nix:

```bash
php -S 0.0.0.0:3001
```

## Test

```bash
curl http://localhost:3001/hello
```

Expected response:

```json
{ "message": "Hello from PHP!" }
```

## Validate Telemetry

Check that traces, logs, and metrics are being received:

```bash
# Search traces for this service
npx @kopai/cli traces search --service php-example

# Search logs for this service
npx @kopai/cli logs search --service php-example

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

This example sends telemetry via OTLP HTTP/JSON directly rather than using the PHP OpenTelemetry SDK. This zero-dependency approach works with PHP's built-in web server and ensures compatibility with all OTLP receivers.

For production use with the OpenTelemetry PHP SDK:

```bash
composer require open-telemetry/sdk open-telemetry/exporter-otlp
```
