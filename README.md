# Kopai Integration Examples

Working examples for integrating with [Kopai](https://kopai.app) observability platform using OpenTelemetry.

## Examples

| Example | Language | SDK Status | Signals |
|---------|----------|------------|---------|
| [node-js](./node-js) | Node.js | Full SDK | Traces, Logs, Metrics |
| [python](./python) | Python | Full SDK | Traces, Logs, Metrics |
| [go](./go) | Go | Full SDK | Traces, Logs, Metrics |
| [java](./java) | Java | Full SDK | Traces, Logs, Metrics |
| [dotnet](./dotnet) | .NET | Full SDK | Traces, Logs, Metrics |
| [ruby](./ruby) | Ruby | Full SDK | Traces, Logs, Metrics |
| [php](./php) | PHP | Full SDK | Traces, Logs, Metrics |
| [rust](./rust) | Rust | Full SDK | Traces, Logs, Metrics |
| [erlang](./erlang) | Elixir | Hybrid | Traces (SDK), Logs/Metrics (Direct HTTP) |
| [cpp](./cpp) | C++ | Direct HTTP | Traces, Logs, Metrics |
| [react-spa](./react-spa) | React + Express | Full SDK | Traces |

## Quick Start

1. Start Kopai backend:
   ```bash
   npx @kopai/app start
   ```

2. Configure environment:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   export OTEL_SERVICE_NAME=my-service
   ```

3. Run an example and validate:
   ```bash
   npx @kopai/cli traces search --service my-service --json
   npx @kopai/cli logs search --service my-service --json
   npx @kopai/cli metrics discover --json
   ```

## SDK Status

- **Full SDK**: Uses official OpenTelemetry SDK for all signals
- **Hybrid**: SDK for some signals, direct OTLP HTTP for others (due to SDK limitations)
- **Direct HTTP**: Uses direct OTLP HTTP/JSON (no SDK available or for demonstration)

## Documentation

- [Getting Started](https://docs.kopai.app/quickstart)
- [Authentication](https://docs.kopai.app/authentication)
- [Browser Integration](https://docs.kopai.app/integration/browser)
- [Node.js Integration](https://docs.kopai.app/integration/node)
- [Java Integration](https://docs.kopai.app/integration/java)
- [Python Integration](https://docs.kopai.app/integration/python)
- [Go Integration](https://docs.kopai.app/integration/go)
- [.NET Integration](https://docs.kopai.app/integration/dotnet)
- [Ruby Integration](https://docs.kopai.app/integration/ruby)
- [PHP Integration](https://docs.kopai.app/integration/php)
- [Rust Integration](https://docs.kopai.app/integration/rust)
- [Elixir Integration](https://docs.kopai.app/integration/elixir)
- [C++ Integration](https://docs.kopai.app/integration/cpp)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/)

## License

MIT
