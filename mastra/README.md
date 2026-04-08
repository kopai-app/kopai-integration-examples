# Mastra AI Agent Integration

AI agent observability with [Mastra](https://mastra.ai) and [Kopai](https://kopai.app). Captures traces, logs, and metrics from agent runs, tool calls, and LLM interactions using OpenTelemetry.

**Documentation:** [Mastra Observability](https://mastra.ai/docs/observability/overview)

## Prerequisites

- Node.js 22+
- Anthropic API key

## Setup

1. Start Kopai backend:
   ```bash
   npx @kopai/app start
   ```

2. Set environment variables:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   export OTEL_SERVICE_NAME=mastra-agent
   export ANTHROPIC_API_KEY=your-api-key
   ```

3. Install and run:
   ```bash
   npm install
   npm start
   ```

## What It Does

Runs a Mastra AI agent (Claude Haiku 4.5) that:
- Checks weather in multiple cities using the `get-weather` tool
- Performs arithmetic using the `calculator` tool
- Handles multi-step prompts combining both tools

Each agent run generates all 3 observability signals:
- **Traces** — full agent decision tree with LLM calls and tool executions
- **Logs** — structured debug/info entries for each agent step
- **Metrics** — agent duration, tool duration, token usage (input/output)

## Trace Hierarchy

A typical agent trace looks like:

```
invoke_agent kopai-assistant              2826ms  (root)
└── chat claude-haiku-4-5-20251001        2823ms
    ├── model_step kopai-assistant         809ms  (1st LLM call)
    │   └── execute_tool calculatorTool      1ms
    ├── model_step kopai-assistant        1069ms  (2nd LLM call)
    │   └── execute_tool calculatorTool      1ms
    └── model_step kopai-assistant         941ms  (final response)
```

## Files

- `instrumentation.mjs` - OpenTelemetry SDK setup with auto-instrumentation
- `src/kopai-exporter.mjs` - Unified exporter for all 3 signals (traces, logs, metrics)
- `src/agent.mjs` - Mastra agent definition with Claude model
- `src/tools.mjs` - Tool definitions (weather + calculator)
- `src/index.mjs` - Demo runner with Observability configuration

## Validating Telemetry

After running the demo, query your data:

```bash
# Search traces — each agent run is a trace with tool call spans
npx @kopai/cli traces search --service mastra-agent --json

# Get full trace details (copy traceId from above)
npx @kopai/cli traces get <traceId> --json

# Search logs — structured agent activity logs
npx @kopai/cli logs search --service mastra-agent --json

# Discover metrics — agent/model/tool duration, token counts
npx @kopai/cli metrics discover --json

# Search specific metrics
npx @kopai/cli metrics search --type Gauge --name mastra_agent_duration_ms --json
```

## Creating a Dashboard

Use this prompt with the Kopai `create-dashboard` skill to generate a dashboard for your Mastra agent telemetry:

> Create a dashboard called "Mastra AI Agent" that shows:
> - A timeline of agent traces with their durations
> - Metrics for agent duration, model duration, and token usage
> - A log timeline showing agent activity
>
> Use `npx @kopai/cli` to discover what metrics and traces are available for the `mastra-agent` service, then build the dashboard accordingly.

## How It Works

The `KopaiExporter` (`src/kopai-exporter.mjs`) is a unified exporter that handles all 3 observability signals through a single configuration:

1. **Traces** — Delegates to Mastra's `@mastra/otel-exporter` internally, which converts Mastra's agent/tool/LLM spans into OpenTelemetry spans and exports them via OTLP
2. **Logs** — Converts Mastra's structured log events to OTLP LogRecord JSON and POSTs to `/v1/logs`
3. **Metrics** — Converts Mastra's metric events (agent duration, token counts) to OTLP Gauge JSON and POSTs to `/v1/metrics`

Additionally, the **OpenTelemetry Node SDK** (`instrumentation.mjs`) provides HTTP-level auto-instrumentation, adding network detail (API calls to Anthropic, tool HTTP requests) to the traces.

## Learn More

- [Mastra Observability](https://mastra.ai/docs/observability/overview) - Mastra's built-in observability
- [Mastra OtelExporter](https://mastra.ai/reference/observability/tracing/exporters/otel) - Custom OTLP export
- [Kopai CLI](https://github.com/kopai-app/kopai-mono/tree/main/packages/cli) - Query telemetry data
- [OpenTelemetry Docs](https://opentelemetry.io/docs/) - OTel reference
