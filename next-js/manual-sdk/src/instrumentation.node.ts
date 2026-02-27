import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "server-side",
  }),
  spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter()),
});

try {
  sdk.start();
} catch (err) {
  console.error("OTel SDK start failed", err);
}

process.on("SIGTERM", () => {
  sdk.shutdown().catch(() => process.exit(0));
});
