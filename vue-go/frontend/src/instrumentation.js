import { trace, metrics } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ZoneContextManager } from "@opentelemetry/context-zone";

import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";

import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import { LongTaskInstrumentation } from "@opentelemetry/instrumentation-long-task";

const SERVICE_NAME = "promptyard-vue";
const SERVICE_VERSION = "0.1.0";

// Browser exporters can't read env at runtime, so VITE_OTEL_EXPORTER_OTLP_*
// build args (mirrors of the OTel SDK's standard env vars) get baked in at
// build time. Defaults:
//   - Local Kopai: VITE_* unset -> exporters POST to same-origin /v1/*, and
//     the Vite dev server proxies to host.docker.internal:4318 (works around
//     kopai-app's missing CORS headers).
//   - Kopai cloud: set the two VITE_* vars below; exporters POST directly to
//     the cloud with the provided headers.
const envEndpoint = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || "";
const envHeaders = import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS || "";

// Parse W3C-Baggage-style "k1=v1,k2=v2" into {k1:v1,k2:v2}, per the OTLP spec.
function parseOtlpHeaders(raw) {
  const out = {};
  for (const pair of raw.split(",")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

const otlpEndpoint = envEndpoint
  ? envEndpoint.replace(/\/$/, "")
  : typeof window !== "undefined"
    ? window.location.origin
    : "";

const otlpHeaders = envHeaders ? parseOtlpHeaders(envHeaders) : undefined;

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: SERVICE_NAME,
  [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
  "deployment.environment": "docker-compose",
});

// ---------- Traces ----------
const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
  headers: otlpHeaders,
});
const tracerProvider = new WebTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(traceExporter)],
});
tracerProvider.register({ contextManager: new ZoneContextManager() });

// ---------- Metrics ----------
const metricExporter = new OTLPMetricExporter({
  url: `${otlpEndpoint}/v1/metrics`,
  headers: otlpHeaders,
});
const meterProvider = new MeterProvider({
  resource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000,
    }),
  ],
});
metrics.setGlobalMeterProvider(meterProvider);

// ---------- Logs ----------
const logExporter = new OTLPLogExporter({
  url: `${otlpEndpoint}/v1/logs`,
  headers: otlpHeaders,
});
const loggerProvider = new LoggerProvider({
  resource,
  processors: [new BatchLogRecordProcessor(logExporter)],
});
logs.setGlobalLoggerProvider(loggerProvider);

// ---------- Singletons ----------
export const tracer = trace.getTracer(SERVICE_NAME);
export const meter = metrics.getMeter(SERVICE_NAME);
export const logger = logs.getLogger(SERVICE_NAME);

// ---------- Custom metric instruments ----------
// Names + units + descriptions are dimensions Kopai surfaces in the metric
// catalog; setting them up-front makes the metrics self-documenting.
export const chatRunAttempts = meter.createCounter(
  "frontend.chat_run.attempts",
  {
    description: "Chat-run buttons clicked from the browser UI",
    unit: "{attempt}",
  },
);
export const chatRunErrors = meter.createCounter("frontend.chat_run.errors", {
  description: "Chat runs that failed before returning a response to the user",
  unit: "{error}",
});
export const chatRunDuration = meter.createHistogram(
  "frontend.chat_run.duration_ms",
  {
    description: "User-perceived chat-run latency (click to rendered response)",
    unit: "ms",
  },
);
export const navCounter = meter.createCounter("frontend.route.navigations", {
  description: "Vue Router navigations",
  unit: "{navigation}",
});

export function setupInstrumentation() {
  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.+/g],
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [/.+/g],
      }),
      new UserInteractionInstrumentation({
        eventNames: ["click", "submit"],
      }),
      new LongTaskInstrumentation(),
    ],
  });

  if (typeof window !== "undefined") {
    window.addEventListener("error", (e) => {
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        body: e.message,
        attributes: { "error.source": "window.error" },
      });
    });
    window.addEventListener("unhandledrejection", (e) => {
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        body: String(e.reason),
        attributes: { "error.source": "unhandledrejection" },
      });
    });
  }

  logger.emit({
    severityNumber: SeverityNumber.INFO,
    body: "promptyard-vue booted",
    attributes: { "otlp.endpoint": otlpEndpoint },
  });
}
