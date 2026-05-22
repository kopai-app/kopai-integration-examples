# Vue SPA + Go Backend + Postgres

Composed multi-service example: Vue 3 frontend, Go HTTP API, and Postgres, all OTel-instrumented and exporting to local Kopai. The backend issues real LLM calls via OpenRouter; Postgres ships pre-seeded with ~60 historical chat records so the dashboard has content immediately.

The app — **Promptyard** — is a team AI usage console: workspaces, prompt templates, model picker, per-call temperature, usage analytics.

**Documentation:** [Browser Integration](https://docs.kopai.app/integration/browser) · [Go Integration](https://docs.kopai.app/integration/go)

## What is OpenTelemetry

OpenTelemetry (OTel) is a vendor-neutral SDK + wire format for three signals: **traces** (spans across services), **logs** (structured events), **metrics** (counters/histograms). The SDK collects them in-process and ships them via OTLP HTTP to a backend — here, Kopai.

Two flavors of instrumentation, both shown in this example:

- **Auto** — drop-in packages (Go `otelhttp` + `otelpgx`, browser `FetchInstrumentation` + `DocumentLoadInstrumentation` etc.) wrap HTTP/DB/`fetch` and emit spans for you.
- **Manual** — call `tracer.Start(...)` (Go) or `tracer.startActiveSpan(...)` (browser) to mark business-meaningful work and attach attributes; emit your own counters/histograms and structured logs.

One browser click lands as one connected trace across browser → Go → DB → OpenRouter, because the browser SDK injects a W3C `traceparent` header on `/api/*` and `otelhttp` on the Go side reads it.

## Prerequisites

- Docker
- Node.js (for `npx @kopai/app start` and `npx @kopai/cli`)
- An [OpenRouter](https://openrouter.ai/) API key

## Setup

```bash
cp .env.example .env
# edit .env, paste OPENROUTER_API_KEY
```

## Run

```bash
# Terminal 1 — local Kopai
npx @kopai/app start

# Terminal 2 — the example
docker compose up --build
```

Open http://localhost:5174. Dashboard renders seeded usage immediately. Pick a workspace, choose a model, write a prompt, click Run — the call hits OpenRouter, persists to Postgres, and emits telemetry across all three services.

To re-seed (wipe DB):

```bash
docker compose down -v && docker compose up --build
```

## Architecture

```
                    ┌────────────────────────┐
                    │    OpenRouter (LLM)    │
                    └────────────▲───────────┘
                                 │
┌──────────────┐    /api/*    ┌──┴───────────┐    ┌──────────────┐
│   Browser    │─────────────▶│  Go backend  │───▶│   Postgres   │
│   (Vue 3)    │              │    :3001     │    │    :5432     │
└──────────────┘              └──────────────┘    └──────────────┘
  promptyard-vue                promptyard-go
```

Three services, each emitting OTel traces, logs, and metrics. The browser's `fetch` instrumentation injects a W3C `traceparent` header on `/api/*` calls; `otelhttp.NewHandler` on the Go side reads it, so a click and its server-side handler end up in the same trace.

### OTel data flow

SDK setup is identical in both modes — only the exporter destination changes. No standalone OTel Collector required in either mode.

**Local mode** (default — OTel vars in `.env` left commented):

```
Browser ──▶ Vite dev server /v1/*  ──▶ host.docker.internal:4318 ──▶ @kopai/app
Go      ────────────────────────────▶ host.docker.internal:4318 ──▶ @kopai/app
```

Browser POSTs to same-origin `/v1/{traces,logs,metrics}`; the Vite dev server proxies those paths to the host's `:4318`. Same-origin is required because `@kopai/app`'s OTLP receiver does not currently send CORS headers. The Go container reaches `:4318` directly via `host.docker.internal`.

**Cloud mode** (`OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-http.kopai.app` in `.env`):

```
Browser ──────────────────────────────▶ https://otlp-http.kopai.app/v1/* ──▶ Kopai cloud
Go      ──────────────────────────────▶ https://otlp-http.kopai.app/v1/* ──▶ Kopai cloud
```

Vite proxy is bypassed entirely. In `frontend/src/instrumentation.js`, the exporter `url` is computed at bundle build time: when `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` is set (docker-compose mirrors it from `OTEL_EXPORTER_OTLP_ENDPOINT`), the bundle ships with the absolute `kopai.app` URL and the browser POSTs straight there with the bundled `Authorization` header. When unset, it falls back to `window.location.origin` — the only case where the Vite proxy catches the request.

The two modes are mutually exclusive:

| Mode  | `OTEL_EXPORTER_OTLP_ENDPOINT` | Browser fetch URL                       | Vite proxy? |
| ----- | ----------------------------- | --------------------------------------- | ----------- |
| Local | unset                         | `http://localhost:5174/v1/traces`       | yes         |
| Cloud | `https://otlp-http.kopai.app` | `https://otlp-http.kopai.app/v1/traces` | no          |

The proxy config stays in `vite.config.js` because local is the zero-config default — dormant whenever the cloud endpoint is baked in.

## Switch to Kopai cloud

Local Kopai is the default. To send telemetry to [kopai.app](https://kopai.app) instead, generate **two access tokens** (browser + backend) at Settings → Access Tokens and uncomment these lines in `.env`:

```
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-http.kopai.app
OTEL_EXPORTER_OTLP_INSECURE=false
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <backend token>
VITE_OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <frontend token>
```

```bash
docker compose up -d --build
```

These are the OTel SDK's standard env vars — `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`. The Go backend picks them up directly from the environment. The browser can't read env vars at runtime, so the `VITE_*` mirrors get baked into the JS bundle at build time (rebuild after changing tokens).

To return to local Kopai, comment those lines back out and re-up.

## Validate telemetry

```bash
npx @kopai/cli traces search
npx @kopai/cli logs search
npx @kopai/cli metrics discover
```

A single chat run should produce one trace stitching:

```
browser  chat.run.ui                   (manual — frontend/src/components/ChatRunner.vue runChat)
   └─ HTTP POST /api/chat/run          (auto   — browser FetchInstrumentation)
       └─ http.server                  (auto   — backend/main.go otelhttp.NewHandler)
           └─ handler.chat_run         (manual — backend/handlers.go handleChatRun)
               ├─ openrouter.chat      (manual — backend/openrouter.go Chat)
               │   └─ HTTP POST openrouter.ai  (auto — otelhttp.NewTransport)
               └─ INSERT llm_calls     (auto   — otelpgx via backend/db.go pool)
```

`(manual)` spans are ones the example explicitly opens with `tracer.Start` / `startActiveSpan`. `(auto)` spans come from drop-in instrumentation packages and need no code at the call site.

## What gets instrumented

**Auto-instrumentation** — packages wired in once at startup, no code at the call sites:

| Where   | Package                                                       | Produces                                                |
| ------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| Backend | `otelhttp.NewHandler` (`main.go`)                             | Server span per request; reads incoming `traceparent`   |
| Backend | `otelhttp.NewTransport` (`openrouter.go`)                     | Client span per outbound HTTP call                      |
| Backend | `otelpgx.NewTracer` (`db.go`)                                 | Span per SQL query, via the pgx pool                    |
| Browser | `FetchInstrumentation`, `XMLHttpRequestInstrumentation`       | Span per `fetch`/XHR; injects `traceparent` on `/api/*` |
| Browser | `DocumentLoadInstrumentation`                                 | Initial page-load span tree                             |
| Browser | `UserInteractionInstrumentation`                              | Span on `click` / `submit`                              |
| Browser | `LongTaskInstrumentation`                                     | Span when main thread blocks > 50ms                     |

**Manual** — the example opens spans, records counters/histograms, and emits logs around units of work (a chat run, a handler, an outbound call). The pattern: start a span, attach attributes that match your other telemetry (`gen_ai.request.model`, `workspace.id`), then emit a counter/histogram/log on the same `ctx` so Kopai correlates them by trace and dimensions. Full enumeration in [Signals emitted](#signals-emitted) below.

### `exception.slug` convention

In `backend/handlers.go` and `frontend/src/components/ChatRunner.vue`, errored spans get an `exception.slug` attribute (e.g. `err-openrouter-chat-failed`). This is **not OTel semconv** — it's a Kopai convention for grouping errors by failure site regardless of exception message. The OTel `RecordError` / `SetStatus` are called alongside so semconv-aware tooling still works.

## Structure

```
vue-go/
├── docker-compose.yml
├── .env.example
├── db/
│   ├── 01_schema.sql              # workspaces, prompt_templates, llm_calls
│   └── 02_seed.sql                # 3 workspaces, 9 templates, ~60 historical calls
├── backend/
│   ├── instrumentation.go         # OTel providers (traces/logs/metrics)
│   ├── db.go                      # pgxpool with otelpgx
│   ├── openrouter.go              # OpenRouter client + custom spans
│   ├── handlers.go                # /api/* endpoints
│   ├── main.go                    # bootstrap + graceful shutdown
│   └── models.go
└── frontend/
    ├── vite.config.js             # proxies /v1/* to local Kopai (same-origin trick)
    └── src/
        ├── instrumentation.js     # browser OTel: traces + metrics + logs
        ├── router.js              # route-change spans
        ├── views/                 # Dashboard, Workspaces, WorkspaceDetail
        └── components/            # UsageCard, ActivityFeed, ChatRunner
```

## Signals emitted

### Backend (`promptyard-go`)

| Signal | Name | Notes |
| --- | --- | --- |
| Trace | HTTP server spans | `otelhttp.NewHandler`, inherits browser `traceparent` |
| Trace | DB query spans | `otelpgx` tracer on pgxpool |
| Trace | `openrouter.chat`, `openrouter.list_models` | Custom, with `llm.model`, `llm.tokens.in`, `llm.tokens.out` |
| Metric | `llm.tokens.consumed` | Counter — by model, workspace |
| Metric | `llm.requests` | Counter — by model, workspace, status |
| Metric | `llm.latency` | Histogram (ms) — by model |
| Log | INFO / ERROR | Chat-run success and failure paths |

### Frontend (`promptyard-vue`)

| Signal | Name | Notes |
| --- | --- | --- |
| Trace | Document load, fetch, XHR, user interaction, long task | Auto-instrumentations |
| Trace | `route.change`, `workspace.load`, `chat.run.ui` | Custom |
| Metric | `frontend.chat_run.attempts` / `.errors` | Counters |
| Metric | `frontend.chat_run.duration_ms` | Histogram (ms) — UI-perceived latency |
| Metric | `frontend.route.navigations` | Counter |
| Log | INFO / ERROR | Boot, chat outcomes, `window.error`, `unhandledrejection` |

## Learn More

- [Browser Integration](https://docs.kopai.app/integration/browser)
- [Go Integration](https://docs.kopai.app/integration/go)
- [Authentication](https://docs.kopai.app/authentication)
