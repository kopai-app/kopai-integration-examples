<?php
/**
 * PHP OpenTelemetry SDK example with OTLP HTTP exporters.
 * Demonstrates traces, logs, and metrics using the official SDK.
 */

// Start output buffering to prevent header issues
ob_start();

require __DIR__ . '/vendor/autoload.php';

use OpenTelemetry\API\Globals;
use OpenTelemetry\API\Logs\LogRecord;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\Contrib\Otlp\LogsExporter;
use OpenTelemetry\Contrib\Otlp\MetricExporter;
use OpenTelemetry\Contrib\Otlp\SpanExporter;
use OpenTelemetry\SDK\Common\Attribute\Attributes;
use OpenTelemetry\SDK\Common\Export\Http\PsrTransportFactory;
use OpenTelemetry\SDK\Logs\LoggerProvider;
use OpenTelemetry\SDK\Logs\Processor\SimpleLogRecordProcessor;
use OpenTelemetry\SDK\Metrics\MeterProvider;
use OpenTelemetry\SDK\Metrics\MetricReader\ExportingReader;
use OpenTelemetry\SDK\Resource\ResourceInfo;
use OpenTelemetry\SDK\Resource\ResourceInfoFactory;
use OpenTelemetry\SDK\Sdk;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use OpenTelemetry\SemConv\ResourceAttributes;
use OpenTelemetry\Contrib\Otlp\ContentTypes;

// Configuration
$otelEndpoint = getenv('OTEL_EXPORTER_OTLP_ENDPOINT') ?: 'http://localhost:4318';
$serviceName = getenv('OTEL_SERVICE_NAME') ?: 'php-example';

// Log to stderr to avoid mixing with HTTP output
function logInfo($message) {
    error_log("[OTel] $message");
}

logInfo("Starting PHP OpenTelemetry SDK example");
logInfo("OTEL endpoint: $otelEndpoint");
logInfo("Service name: $serviceName");

// Create resource with service information
$resource = ResourceInfoFactory::emptyResource()->merge(
    ResourceInfo::create(Attributes::create([
        ResourceAttributes::SERVICE_NAME => $serviceName,
        ResourceAttributes::TELEMETRY_SDK_LANGUAGE => 'php',
    ]))
);

// Create HTTP transport factory
$transportFactory = PsrTransportFactory::discover();

// === TRACES SETUP ===
$tracesEndpoint = "$otelEndpoint/v1/traces";
logInfo("Traces endpoint: $tracesEndpoint");

$traceTransport = $transportFactory->create(
    $tracesEndpoint,
    ContentTypes::JSON
);
$spanExporter = new SpanExporter($traceTransport);

$tracerProvider = TracerProvider::builder()
    ->addSpanProcessor(new SimpleSpanProcessor($spanExporter))
    ->setResource($resource)
    ->build();

// === METRICS SETUP ===
$metricsEndpoint = "$otelEndpoint/v1/metrics";
logInfo("Metrics endpoint: $metricsEndpoint");

try {
    $metricsTransport = $transportFactory->create(
        $metricsEndpoint,
        ContentTypes::JSON
    );
    $metricExporter = new MetricExporter($metricsTransport);
    $metricReader = new ExportingReader($metricExporter);

    $meterProvider = MeterProvider::builder()
        ->setResource($resource)
        ->addReader($metricReader)
        ->build();

    logInfo("Metrics configured");
} catch (Throwable $e) {
    logInfo("Metrics not available: " . $e->getMessage());
    $meterProvider = null;
}

// === LOGS SETUP ===
$logsEndpoint = "$otelEndpoint/v1/logs";
logInfo("Logs endpoint: $logsEndpoint");

try {
    $logsTransport = $transportFactory->create(
        $logsEndpoint,
        ContentTypes::JSON
    );
    $logsExporter = new LogsExporter($logsTransport);

    $loggerProvider = LoggerProvider::builder()
        ->setResource($resource)
        ->addLogRecordProcessor(new SimpleLogRecordProcessor($logsExporter))
        ->build();

    logInfo("Logs configured");
} catch (Throwable $e) {
    logInfo("Logs not available: " . $e->getMessage());
    $loggerProvider = null;
}

// Register providers globally
$sdkBuilder = Sdk::builder()
    ->setTracerProvider($tracerProvider)
    ->setAutoShutdown(true);

if ($meterProvider) {
    $sdkBuilder->setMeterProvider($meterProvider);
}
if ($loggerProvider) {
    $sdkBuilder->setLoggerProvider($loggerProvider);
}

$sdkBuilder->buildAndRegisterGlobal();

logInfo("OpenTelemetry SDK configured");

// Get tracer, meter, and logger
$tracer = Globals::tracerProvider()->getTracer($serviceName);
$meter = $meterProvider ? Globals::meterProvider()->getMeter($serviceName) : null;
$logger = $loggerProvider ? Globals::loggerProvider()->getLogger($serviceName) : null;

// Create counter if metrics available
$requestCounter = $meter?->createCounter(
    'hello.requests',
    '1',
    'Number of hello requests'
);

// Clear any output that might have been generated during setup
ob_end_clean();

// Simple router
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/hello', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($uri === '/hello' && $method === 'GET') {
    // Create span for the request
    $span = $tracer->spanBuilder('GET /hello')
        ->setSpanKind(SpanKind::KIND_SERVER)
        ->startSpan();

    $scope = $span->activate();

    try {
        $span->setAttribute('http.method', 'GET');
        $span->setAttribute('http.route', '/hello');

        // Increment counter metric
        $requestCounter?->add(1, ['endpoint' => '/hello']);

        // Emit log
        if ($logger) {
            $logger->emit(
                (new LogRecord('Hello endpoint called'))
                    ->setSeverityText('INFO')
                    ->setAttributes(['endpoint' => '/hello'])
            );
        }

        $span->setStatus(StatusCode::STATUS_OK);

        // Return JSON response
        header('Content-Type: application/json');
        echo json_encode(['message' => 'Hello from PHP!']);
    } catch (Throwable $e) {
        $span->setStatus(StatusCode::STATUS_ERROR, $e->getMessage());
        $span->recordException($e);
        throw $e;
    } finally {
        $span->end();
        $scope->detach();
    }
    exit;
}

// 404 for other routes
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Not found']);
