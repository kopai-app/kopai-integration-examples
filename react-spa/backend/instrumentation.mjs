import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const AUTH_HEADERS = {
  Authorization: `Bearer <YOUR_KOPAI_BE_TOKEN_HERE>`,
};

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: "otel-survey-backend",
  [ATTR_SERVICE_VERSION]: "1.1.1",
});

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "https://otlp-http.kopai.app/v1/traces",
    headers: AUTH_HEADERS,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: "https://otlp-http.kopai.app/v1/metrics",
      headers: AUTH_HEADERS,
    }),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  resource,
});

sdk.start();
