"use client";

import { useEffect, useRef } from "react";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";

export default function OtelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const exporter = new OTLPTraceExporter({
        url: "/api/otel",
      });

      const provider = new WebTracerProvider({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: "client-side",
        }),
        spanProcessors: [new BatchSpanProcessor(exporter)],
      });

      provider.register({
        contextManager: new ZoneContextManager(),
      });

      registerInstrumentations({
        instrumentations: [
          new DocumentLoadInstrumentation(),
          new FetchInstrumentation({
            propagateTraceHeaderCorsUrls: [/.*/],
            ignoreUrls: [/\/api\/otel/],
          }),
        ],
      });

      console.log("[OTel] Browser instrumentation initialized");
    } catch (err) {
      console.error("[OTel] Browser instrumentation failed", err);
    }
  }, []);

  return <>{children}</>;
}
