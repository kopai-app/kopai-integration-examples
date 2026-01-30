// C++ OpenTelemetry SDK example with OTLP HTTP exporters
// Demonstrates traces, logs, and metrics using the official SDK

#include <httplib.h>
#include <cstdlib>
#include <iostream>
#include <string>
#include <memory>

// OpenTelemetry trace includes
#include "opentelemetry/exporters/otlp/otlp_http_exporter_factory.h"
#include "opentelemetry/exporters/otlp/otlp_http_exporter_options.h"
#include "opentelemetry/sdk/trace/tracer_provider_factory.h"
#include "opentelemetry/sdk/trace/tracer_provider.h"
#include "opentelemetry/sdk/trace/batch_span_processor_factory.h"
#include "opentelemetry/sdk/trace/batch_span_processor_options.h"
#include "opentelemetry/trace/provider.h"

// OpenTelemetry metrics includes
#include "opentelemetry/exporters/otlp/otlp_http_metric_exporter_factory.h"
#include "opentelemetry/exporters/otlp/otlp_http_metric_exporter_options.h"
#include "opentelemetry/sdk/metrics/meter_provider_factory.h"
#include "opentelemetry/sdk/metrics/meter_provider.h"
#include "opentelemetry/sdk/metrics/meter_context_factory.h"
#include "opentelemetry/sdk/metrics/export/periodic_exporting_metric_reader_factory.h"
#include "opentelemetry/sdk/metrics/export/periodic_exporting_metric_reader_options.h"
#include "opentelemetry/metrics/provider.h"

// OpenTelemetry logs includes
#include "opentelemetry/exporters/otlp/otlp_http_log_record_exporter_factory.h"
#include "opentelemetry/exporters/otlp/otlp_http_log_record_exporter_options.h"
#include "opentelemetry/sdk/logs/logger_provider_factory.h"
#include "opentelemetry/sdk/logs/logger_provider.h"
#include "opentelemetry/sdk/logs/simple_log_record_processor_factory.h"
#include "opentelemetry/logs/provider.h"

// Resource includes
#include "opentelemetry/sdk/resource/resource.h"
#include "opentelemetry/sdk/resource/semantic_conventions.h"

namespace trace_api = opentelemetry::trace;
namespace trace_sdk = opentelemetry::sdk::trace;
namespace trace_exporter = opentelemetry::exporter::otlp;

namespace metrics_api = opentelemetry::metrics;
namespace metrics_sdk = opentelemetry::sdk::metrics;
namespace metrics_exporter = opentelemetry::exporter::otlp;

namespace logs_api = opentelemetry::logs;
namespace logs_sdk = opentelemetry::sdk::logs;
namespace logs_exporter = opentelemetry::exporter::otlp;

namespace resource = opentelemetry::sdk::resource;

std::string getEndpoint() {
    const char* env = std::getenv("OTEL_EXPORTER_OTLP_ENDPOINT");
    return env ? env : "http://localhost:4318";
}

std::string getServiceName() {
    const char* env = std::getenv("OTEL_SERVICE_NAME");
    return env ? env : "cpp-example";
}

// Create resource with service name
resource::Resource createResource() {
    return resource::Resource::Create({
        {resource::SemanticConventions::kServiceName, getServiceName()},
        {"telemetry.sdk.language", "cpp"}
    });
}

// Initialize TracerProvider with OTLP HTTP exporter
void InitTracer() {
    trace_exporter::OtlpHttpExporterOptions opts;
    opts.url = getEndpoint() + "/v1/traces";

    auto exporter = trace_exporter::OtlpHttpExporterFactory::Create(opts);

    trace_sdk::BatchSpanProcessorOptions processor_opts;
    processor_opts.max_queue_size = 2048;
    processor_opts.max_export_batch_size = 512;

    auto processor = trace_sdk::BatchSpanProcessorFactory::Create(
        std::move(exporter), processor_opts);

    std::shared_ptr<trace_api::TracerProvider> provider =
        trace_sdk::TracerProviderFactory::Create(std::move(processor), createResource());

    trace_api::Provider::SetTracerProvider(provider);
}

// Initialize MeterProvider with OTLP HTTP exporter
void InitMeter() {
    metrics_exporter::OtlpHttpMetricExporterOptions opts;
    opts.url = getEndpoint() + "/v1/metrics";

    auto exporter = metrics_exporter::OtlpHttpMetricExporterFactory::Create(opts);

    metrics_sdk::PeriodicExportingMetricReaderOptions reader_opts;
    reader_opts.export_interval_millis = std::chrono::milliseconds(1000);
    reader_opts.export_timeout_millis = std::chrono::milliseconds(500);

    auto reader = metrics_sdk::PeriodicExportingMetricReaderFactory::Create(
        std::move(exporter), reader_opts);

    // Create meter context with resource
    auto context = metrics_sdk::MeterContextFactory::Create();
    context->AddMetricReader(std::move(reader));

    std::shared_ptr<metrics_api::MeterProvider> provider =
        metrics_sdk::MeterProviderFactory::Create(std::move(context));

    metrics_api::Provider::SetMeterProvider(provider);
}

// Initialize LoggerProvider with OTLP HTTP exporter
void InitLogger() {
    logs_exporter::OtlpHttpLogRecordExporterOptions opts;
    opts.url = getEndpoint() + "/v1/logs";

    auto exporter = logs_exporter::OtlpHttpLogRecordExporterFactory::Create(opts);

    auto processor = logs_sdk::SimpleLogRecordProcessorFactory::Create(
        std::move(exporter));

    std::shared_ptr<logs_api::LoggerProvider> provider =
        logs_sdk::LoggerProviderFactory::Create(std::move(processor), createResource());

    logs_api::Provider::SetLoggerProvider(provider);
}

// Cleanup providers on shutdown
void CleanupProviders() {
    auto tracer_provider = trace_api::Provider::GetTracerProvider();
    if (auto* tp = dynamic_cast<trace_sdk::TracerProvider*>(tracer_provider.get())) {
        tp->Shutdown();
    }

    auto meter_provider = metrics_api::Provider::GetMeterProvider();
    if (auto* mp = dynamic_cast<metrics_sdk::MeterProvider*>(meter_provider.get())) {
        mp->Shutdown();
    }

    auto logger_provider = logs_api::Provider::GetLoggerProvider();
    if (auto* lp = dynamic_cast<logs_sdk::LoggerProvider*>(logger_provider.get())) {
        lp->Shutdown();
    }
}

int main() {
    std::string endpoint = getEndpoint();
    std::string serviceName = getServiceName();

    std::cout << "Starting server with OTEL endpoint: " << endpoint << std::endl;
    std::cout << "Service name: " << serviceName << std::endl;

    // Initialize OpenTelemetry providers
    InitTracer();
    InitMeter();
    InitLogger();

    // Get tracer, meter, logger
    auto tracer = trace_api::Provider::GetTracerProvider()->GetTracer(serviceName);
    auto meter = metrics_api::Provider::GetMeterProvider()->GetMeter(serviceName);
    auto logger = logs_api::Provider::GetLoggerProvider()->GetLogger(serviceName);

    // Create counter metric
    auto counter = meter->CreateUInt64Counter("hello.requests", "Number of hello requests");

    // Create HTTP server
    httplib::Server svr;

    svr.Get("/hello", [&](const httplib::Request& req, httplib::Response& res) {
        // Create span for the request
        auto span = tracer->StartSpan("GET /hello");
        auto scope = tracer->WithActiveSpan(span);

        span->SetAttribute("http.method", "GET");
        span->SetAttribute("http.route", "/hello");
        span->SetAttribute("http.status_code", 200);

        // Increment counter
        counter->Add(1, {{"endpoint", "/hello"}});

        // Log the request
        logger->Info("Hello endpoint called");

        // End span
        span->SetStatus(opentelemetry::trace::StatusCode::kOk);
        span->End();

        // Set response
        res.set_content(R"({"message": "Hello from C++!"})", "application/json");
    });

    std::cout << "Server listening on :3001" << std::endl;

    // Run server (blocking)
    svr.listen("0.0.0.0", 3001);

    // Cleanup on shutdown
    CleanupProviders();

    return 0;
}
