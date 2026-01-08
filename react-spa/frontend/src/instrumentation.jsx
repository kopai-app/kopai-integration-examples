import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export const setupInstrumentation = () => {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "otel-survey-spa",
    [ATTR_SERVICE_VERSION]: "1.2.3",
  });

  const otlpExporter = new OTLPTraceExporter({
    url: "https://otlp-http.kopai.app/v1/traces",
    headers: {
      Authorization: `Bearer <YOUR_KOPAI_FE_TOKEN_HERE>`,
    },
  });

  const spanProcessor = new BatchSpanProcessor(otlpExporter);
  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /.+/g, // Propagate to all backend URLs
        ],
      }),
    ],
  });
};
