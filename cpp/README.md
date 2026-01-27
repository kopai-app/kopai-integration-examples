# C++ OpenTelemetry SDK Example

This example demonstrates OpenTelemetry instrumentation in C++ using the **official OpenTelemetry C++ SDK** with OTLP HTTP exporters. It creates a simple HTTP server that emits traces, logs, and metrics.

## Features

- **Traces**: Server spans with HTTP attributes
- **Logs**: Application logs via LoggerProvider
- **Metrics**: Request counter via MeterProvider
- **OTLP HTTP Export**: All signals exported via HTTP/protobuf

## Prerequisites

- [Nix](https://nixos.org/download.html) with flakes enabled
- Running OTLP collector (e.g., `npx @kopai/app start`)

## Quick Start

```bash
# Enter Nix development environment
nix develop

# Build (first time: ~5-10 min for OpenTelemetry SDK compilation)
cmake -B build
cmake --build build

# Start OTLP collector in another terminal
npx @kopai/app start

# Run the example
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_SERVICE_NAME=cpp-example \
./build/cpp-example
```

## Test the Endpoint

```bash
curl http://localhost:3001/hello
# {"message": "Hello from C++!"}
```

## Validate Telemetry

```bash
# Check traces
npx @kopai/cli traces search --service cpp-example

# Check logs
npx @kopai/cli logs search --service cpp-example

# Check metrics
npx @kopai/cli metrics discover
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP collector endpoint |
| `OTEL_SERVICE_NAME` | `cpp-example` | Service name for telemetry |

## Project Structure

```
cpp/
├── flake.nix          # Nix development environment
├── CMakeLists.txt     # CMake build configuration
├── src/
│   └── main.cpp       # Application with SDK instrumentation
└── README.md          # This file
```

## How It Works

The example uses the official OpenTelemetry C++ SDK:

1. **TracerProvider**: Configured with `OtlpHttpExporter` and `BatchSpanProcessor`
2. **MeterProvider**: Configured with `OtlpHttpMetricExporter` and `PeriodicExportingMetricReader`
3. **LoggerProvider**: Configured with `OtlpHttpLogRecordExporter` and `SimpleLogRecordProcessor`

Each provider is initialized with a `Resource` containing the service name.

## Dependencies

Built via CMake FetchContent:
- [opentelemetry-cpp](https://github.com/open-telemetry/opentelemetry-cpp) v1.18.0 - OpenTelemetry SDK
- [cpp-httplib](https://github.com/yhirose/cpp-httplib) - Header-only HTTP server

System dependencies (via Nix):
- GCC, CMake, Ninja
- protobuf, curl, abseil-cpp, nlohmann_json

## Build Time

- **First build**: 5-10 minutes (compiles opentelemetry-cpp from source)
- **Subsequent builds**: < 1 minute (cached)
