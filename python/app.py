"""Minimal Python OpenTelemetry example with Flask."""

import logging
import os

from flask import Flask, jsonify

from opentelemetry import trace, metrics
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter

# Configuration from environment
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "python-example")

# Create resource with service name
resource = Resource.create({"service.name": SERVICE_NAME})

# Setup Traces
trace_provider = TracerProvider(resource=resource)
trace_provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{OTEL_ENDPOINT}/v1/traces"))
)
trace.set_tracer_provider(trace_provider)
tracer = trace.get_tracer(__name__)

# Setup Metrics
metric_reader = PeriodicExportingMetricReader(
    OTLPMetricExporter(endpoint=f"{OTEL_ENDPOINT}/v1/metrics"),
    export_interval_millis=5000,
)
meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)
meter = metrics.get_meter(__name__)

# Create a counter metric
hello_counter = meter.create_counter(
    name="hello.requests",
    description="Number of hello requests",
    unit="1",
)

# Setup Logs
logger_provider = LoggerProvider(resource=resource)
logger_provider.add_log_record_processor(
    BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{OTEL_ENDPOINT}/v1/logs"))
)
handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
logging.getLogger().addHandler(handler)
logging.getLogger().setLevel(logging.INFO)
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)


@app.route("/hello")
def hello():
    """Handle GET /hello - emits trace, metric, and log."""
    with tracer.start_as_current_span("hello-handler") as span:
        span.set_attribute("http.method", "GET")
        span.set_attribute("http.route", "/hello")

        hello_counter.add(1, {"endpoint": "/hello"})

        logger.info("Hello endpoint called")

        return jsonify({"message": "Hello from Python!"})


if __name__ == "__main__":
    print(f"Starting server with OTEL endpoint: {OTEL_ENDPOINT}")
    print(f"Service name: {SERVICE_NAME}")
    app.run(host="0.0.0.0", port=3001)
