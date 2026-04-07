import { BaseExporter } from "@mastra/observability";
import { OtelExporter } from "@mastra/otel-exporter";

const SEVERITY_MAP = {
  debug: { number: 5, text: "DEBUG" },
  info: { number: 9, text: "INFO" },
  warn: { number: 13, text: "WARN" },
  error: { number: 17, text: "ERROR" },
  fatal: { number: 21, text: "FATAL" },
};

function toOtlpAttributes(obj) {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value:
      typeof value === "number"
        ? Number.isInteger(value)
          ? { intValue: String(value) }
          : { doubleValue: value }
        : typeof value === "boolean"
          ? { boolValue: value }
          : { stringValue: String(value) },
  }));
}

function toNanos(date) {
  return String(BigInt(date.getTime()) * 1000000n);
}

export class KopaiExporter extends BaseExporter {
  name = "kopai";
  #otelExporter;
  #endpoint;
  #serviceName;
  #logBuffer = [];
  #metricBuffer = [];
  #flushTimer;
  #maxBufferSize;

  constructor({
    endpoint = "http://localhost:4318",
    serviceName,
    protocol = "http/json",
    flushIntervalMs = 5000,
    maxBufferSize = 50,
  } = {}) {
    super();
    this.#endpoint = endpoint;
    this.#serviceName = serviceName || "mastra-agent";
    this.#maxBufferSize = maxBufferSize;
    this.#otelExporter = new OtelExporter({
      provider: {
        custom: {
          endpoint: `${endpoint}/v1/traces`,
          protocol,
        },
      },
    });
    this.#flushTimer = setInterval(() => this.#flushBuffers(), flushIntervalMs);
    this.#flushTimer.unref();
  }

  init(options) {
    this.#otelExporter.init(options);
  }

  async _exportTracingEvent(event) {
    await this.#otelExporter.exportTracingEvent(event);
  }

  async onLogEvent(event) {
    this.#logBuffer.push(event.log);
    if (this.#logBuffer.length >= this.#maxBufferSize) {
      await this.#flushLogs();
    }
  }

  async onMetricEvent(event) {
    this.#metricBuffer.push(event.metric);
    if (this.#metricBuffer.length >= this.#maxBufferSize) {
      await this.#flushMetrics();
    }
  }

  async flush() {
    await this.#flushBuffers();
    await this.#otelExporter.flush();
  }

  async shutdown() {
    clearInterval(this.#flushTimer);
    await this.flush();
    await this.#otelExporter.shutdown();
  }

  async #flushBuffers() {
    await Promise.all([this.#flushLogs(), this.#flushMetrics()]);
  }

  async #flushLogs() {
    if (this.#logBuffer.length === 0) return;
    const logs = this.#logBuffer.splice(0);
    const body = {
      resourceLogs: [
        {
          resource: {
            attributes: toOtlpAttributes({ "service.name": this.#serviceName }),
          },
          scopeLogs: [
            {
              scope: { name: "kopai-exporter" },
              logRecords: logs.map((log) => {
                const severity = SEVERITY_MAP[log.level] || SEVERITY_MAP.info;
                const attributes = [
                  ...toOtlpAttributes(log.data),
                  ...toOtlpAttributes(log.metadata),
                ];
                if (log.correlationContext?.entityName) {
                  attributes.push({
                    key: "entity.name",
                    value: { stringValue: log.correlationContext.entityName },
                  });
                }
                if (log.correlationContext?.entityType) {
                  attributes.push({
                    key: "entity.type",
                    value: { stringValue: log.correlationContext.entityType },
                  });
                }
                return {
                  timeUnixNano: toNanos(log.timestamp),
                  severityNumber: severity.number,
                  severityText: severity.text,
                  body: { stringValue: log.message },
                  attributes,
                  ...(log.traceId && { traceId: log.traceId }),
                  ...(log.spanId && { spanId: log.spanId }),
                };
              }),
            },
          ],
        },
      ],
    };
    await this.#post("/v1/logs", body);
  }

  async #flushMetrics() {
    if (this.#metricBuffer.length === 0) return;
    const metrics = this.#metricBuffer.splice(0);
    const body = {
      resourceMetrics: [
        {
          resource: {
            attributes: toOtlpAttributes({ "service.name": this.#serviceName }),
          },
          scopeMetrics: [
            {
              scope: { name: "kopai-exporter" },
              metrics: metrics.map((metric) => ({
                name: metric.name,
                gauge: {
                  dataPoints: [
                    {
                      timeUnixNano: toNanos(metric.timestamp),
                      asDouble: metric.value,
                      attributes: [
                        ...toOtlpAttributes(metric.labels),
                        ...(metric.traceId
                          ? [
                              {
                                key: "trace_id",
                                value: { stringValue: metric.traceId },
                              },
                            ]
                          : []),
                      ],
                    },
                  ],
                },
              })),
            },
          ],
        },
      ],
    };
    await this.#post("/v1/metrics", body);
  }

  async #post(path, body) {
    try {
      const response = await fetch(`${this.#endpoint}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        console.warn(
          `[KopaiExporter] Failed to send to ${path}: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.warn(`[KopaiExporter] Error sending to ${path}:`, error.message);
    }
  }
}
