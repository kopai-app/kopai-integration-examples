use axum::{routing::get, Json, Router};
use opentelemetry::{
    global,
    trace::{Status, TraceContextExt, Tracer},
    KeyValue,
};
use opentelemetry_otlp::{Protocol, WithExportConfig};
use opentelemetry_sdk::{
    metrics::{PeriodicReader, SdkMeterProvider},
    trace::SdkTracerProvider,
    Resource,
};
use serde::Serialize;
use std::env;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

static REQUEST_COUNT: AtomicU64 = AtomicU64::new(0);

fn get_endpoint() -> String {
    env::var("OTEL_EXPORTER_OTLP_ENDPOINT").unwrap_or_else(|_| "http://localhost:4318".to_string())
}

fn get_service_name() -> String {
    env::var("OTEL_SERVICE_NAME").unwrap_or_else(|_| "rust-example".to_string())
}

fn init_tracer_provider() -> SdkTracerProvider {
    let endpoint = get_endpoint();
    let service_name = get_service_name();

    println!("Traces endpoint: {}/v1/traces", endpoint);

    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_protocol(Protocol::HttpJson)
        .with_endpoint(format!("{}/v1/traces", endpoint))
        .build()
        .expect("Failed to create span exporter");

    let resource = Resource::builder()
        .with_service_name(service_name.clone())
        .with_attribute(KeyValue::new("telemetry.sdk.language", "rust"))
        .build();

    let provider = SdkTracerProvider::builder()
        .with_resource(resource)
        .with_batch_exporter(exporter)
        .build();

    global::set_tracer_provider(provider.clone());
    println!("Traces configured");
    provider
}

fn init_meter_provider() -> SdkMeterProvider {
    let endpoint = get_endpoint();
    let service_name = get_service_name();

    println!("Metrics endpoint: {}/v1/metrics", endpoint);

    let exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_http()
        .with_protocol(Protocol::HttpJson)
        .with_endpoint(format!("{}/v1/metrics", endpoint))
        .build()
        .expect("Failed to create metric exporter");

    let reader = PeriodicReader::builder(exporter)
        .with_interval(Duration::from_secs(5))
        .build();

    let resource = Resource::builder()
        .with_service_name(service_name.clone())
        .with_attribute(KeyValue::new("telemetry.sdk.language", "rust"))
        .build();

    let provider = SdkMeterProvider::builder()
        .with_resource(resource)
        .with_reader(reader)
        .build();

    global::set_meter_provider(provider.clone());
    println!("Metrics configured");
    provider
}

fn init_logger_provider() -> opentelemetry_sdk::logs::SdkLoggerProvider {
    let endpoint = get_endpoint();
    let service_name = get_service_name();

    println!("Logs endpoint: {}/v1/logs", endpoint);

    let exporter = opentelemetry_otlp::LogExporter::builder()
        .with_http()
        .with_protocol(Protocol::HttpJson)
        .with_endpoint(format!("{}/v1/logs", endpoint))
        .build()
        .expect("Failed to create log exporter");

    let resource = Resource::builder()
        .with_service_name(service_name.clone())
        .with_attribute(KeyValue::new("telemetry.sdk.language", "rust"))
        .build();

    let provider = opentelemetry_sdk::logs::SdkLoggerProvider::builder()
        .with_resource(resource)
        .with_batch_exporter(exporter)
        .build();

    println!("Logs configured");
    provider
}

#[derive(Serialize)]
struct HelloResponse {
    message: String,
}

async fn hello_handler() -> Json<HelloResponse> {
    let tracer = global::tracer("rust-example");
    let meter = global::meter("rust-example");

    // Create counter
    let counter = meter.u64_counter("hello.requests").build();

    // Create span for the request
    tracer.in_span("GET /hello", |cx| {
        let span = cx.span();
        span.set_attribute(KeyValue::new("http.method", "GET"));
        span.set_attribute(KeyValue::new("http.route", "/hello"));

        // Increment counter metric
        let count = REQUEST_COUNT.fetch_add(1, Ordering::SeqCst) + 1;
        counter.add(count, &[KeyValue::new("endpoint", "/hello")]);

        // Note: For logs, you would typically use tracing macros
        // which integrate with opentelemetry-appender-tracing
        tracing::info!(endpoint = "/hello", "Hello endpoint called");

        span.set_status(Status::Ok);
    });

    Json(HelloResponse {
        message: "Hello from Rust!".to_string(),
    })
}

#[tokio::main]
async fn main() {
    let endpoint = get_endpoint();
    let service_name = get_service_name();

    println!("Starting server with OTEL endpoint: {}", endpoint);
    println!("Service name: {}", service_name);

    // Initialize OpenTelemetry providers
    let tracer_provider = init_tracer_provider();
    let meter_provider = init_meter_provider();
    let logger_provider = init_logger_provider();

    // Set up tracing subscriber with OpenTelemetry layer
    use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
    use tracing_subscriber::layer::SubscriberExt;
    use tracing_subscriber::util::SubscriberInitExt;

    let otel_layer = OpenTelemetryTracingBridge::new(&logger_provider);

    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(otel_layer)
        .init();

    println!("Server listening on :3001");

    let app = Router::new().route("/hello", get(hello_handler));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();

    // Graceful shutdown
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    tokio::select! {
        _ = axum::serve(listener, app) => {},
        _ = ctrl_c => {
            println!("\nShutting down OpenTelemetry providers...");
            let _ = tracer_provider.shutdown();
            let _ = meter_provider.shutdown();
            let _ = logger_provider.shutdown();
        }
    }
}
