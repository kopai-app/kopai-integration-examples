# Ruby OpenTelemetry SDK example with OTLP HTTP exporters
# Demonstrates traces, logs, and metrics using the official SDK

# Ensure output is flushed immediately
$stdout.sync = true
$stderr.sync = true

require 'sinatra'
require 'json'

# OpenTelemetry SDK requires
require 'opentelemetry/sdk'
require 'opentelemetry/exporter/otlp'
require 'opentelemetry/instrumentation/sinatra'

# Configuration
OTEL_ENDPOINT = ENV['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318'
SERVICE_NAME = ENV['OTEL_SERVICE_NAME'] || 'ruby-example'
TRACES_ENDPOINT = "#{OTEL_ENDPOINT}/v1/traces"

puts "Starting server with OTEL endpoint: #{OTEL_ENDPOINT}"
puts "Traces endpoint: #{TRACES_ENDPOINT}"
puts "Service name: #{SERVICE_NAME}"

# Configure OpenTelemetry SDK for Traces
# Explicitly set the endpoint for the OTLP exporter
# Disable gzip compression to ensure compatibility with kopai
trace_exporter = OpenTelemetry::Exporter::OTLP::Exporter.new(
  endpoint: TRACES_ENDPOINT,
  compression: 'none'
)

OpenTelemetry::SDK.configure do |c|
  c.service_name = SERVICE_NAME
  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(trace_exporter)
  )
  # Enable Sinatra auto-instrumentation
  c.use 'OpenTelemetry::Instrumentation::Sinatra'
end

puts "Traces configured"

# Metrics SDK (experimental)
begin
  require 'opentelemetry-metrics-sdk'
  require 'opentelemetry/exporter/otlp_metrics'

  # Create a MeterProvider with resource
  resource = OpenTelemetry::SDK::Resources::Resource.create(
    'service.name' => SERVICE_NAME,
    'telemetry.sdk.language' => 'ruby'
  )

  # Explicitly set the metrics endpoint
  metrics_endpoint = "#{OTEL_ENDPOINT}/v1/metrics"
  puts "Metrics endpoint: #{metrics_endpoint}"
  metrics_exporter = OpenTelemetry::Exporter::OTLP::Metrics::MetricsExporter.new(
    endpoint: metrics_endpoint,
    compression: 'none'
  )

  # Create a MeterProvider and add the metric reader
  $meter_provider = OpenTelemetry::SDK::Metrics::MeterProvider.new(resource: resource)
  $meter_provider.add_metric_reader(metrics_exporter)

  # Set as global meter provider
  OpenTelemetry.meter_provider = $meter_provider

  $meter = $meter_provider.meter(SERVICE_NAME)
  $request_counter = $meter.create_counter(
    'hello.requests',
    unit: '1',
    description: 'Number of hello requests'
  )
  puts "Metrics configured"
rescue LoadError, NameError => e
  puts "Metrics SDK not available: #{e.message}"
  $meter_provider = nil
  $meter = nil
  $request_counter = nil
end

# Logs SDK (experimental)
begin
  require 'opentelemetry-logs-sdk'
  require 'opentelemetry-exporter-otlp-logs'

  resource = OpenTelemetry::SDK::Resources::Resource.create(
    'service.name' => SERVICE_NAME,
    'telemetry.sdk.language' => 'ruby'
  )

  $logger_provider = OpenTelemetry::SDK::Logs::LoggerProvider.new(resource: resource)
  # Explicitly set the logs endpoint
  logs_endpoint = "#{OTEL_ENDPOINT}/v1/logs"
  puts "Logs endpoint: #{logs_endpoint}"
  logs_processor = OpenTelemetry::SDK::Logs::Export::BatchLogRecordProcessor.new(
    OpenTelemetry::Exporter::OTLP::Logs::LogsExporter.new(
      endpoint: logs_endpoint,
      compression: 'none'
    )
  )
  $logger_provider.add_log_record_processor(logs_processor)
  $otel_logger = $logger_provider.logger(name: SERVICE_NAME)
  puts "Logs configured"
rescue LoadError, NameError => e
  puts "Logs SDK not available: #{e.message}"
  $logger_provider = nil
  $otel_logger = nil
end

# Get tracer
$tracer = OpenTelemetry.tracer_provider.tracer(SERVICE_NAME)

# Configure Sinatra
set :port, 3001
set :bind, '0.0.0.0'

get '/hello' do
  content_type :json

  # Create a span for additional custom instrumentation
  $tracer.in_span('process_hello', attributes: { 'http.route' => '/hello' }) do |span|
    # Increment counter metric if available
    if $request_counter
      $request_counter.add(1, attributes: { 'endpoint' => '/hello' })
    end

    # Emit log via SDK if available
    if $otel_logger
      $otel_logger.on_emit(
        timestamp: Time.now,
        severity_text: 'INFO',
        body: 'Hello endpoint called',
        attributes: { 'endpoint' => '/hello' }
      )
    end

    span.set_attribute('custom.processed', true)
  end

  { message: 'Hello from Ruby!' }.to_json
end

# Note: Shutdown is handled automatically by the SDK when the process exits
# We don't use at_exit because it conflicts with Sinatra's process management

puts "Server listening on :3001"
