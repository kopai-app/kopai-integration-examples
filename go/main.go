// Minimal Go OpenTelemetry example with HTTP server.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otellog "go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/metric"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

var (
	tracer       = otel.Tracer("go-example")
	meter        = otel.Meter("go-example")
	logger       otellog.Logger
	helloCounter metric.Int64Counter
)

func main() {
	ctx := context.Background()

	// Get configuration from environment
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://localhost:4318"
	}
	serviceName := os.Getenv("OTEL_SERVICE_NAME")
	if serviceName == "" {
		serviceName = "go-example"
	}

	fmt.Printf("Starting server with OTEL endpoint: %s\n", endpoint)
	fmt.Printf("Service name: %s\n", serviceName)

	// Create resource with service name
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		log.Fatalf("Failed to create resource: %v", err)
	}

	// Setup Traces
	traceExporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(stripProtocol(endpoint)),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		log.Fatalf("Failed to create trace exporter: %v", err)
	}
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tracerProvider)

	// Setup Metrics
	metricExporter, err := otlpmetrichttp.New(ctx,
		otlpmetrichttp.WithEndpoint(stripProtocol(endpoint)),
		otlpmetrichttp.WithInsecure(),
	)
	if err != nil {
		log.Fatalf("Failed to create metric exporter: %v", err)
	}
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter,
			sdkmetric.WithInterval(5*time.Second),
		)),
		sdkmetric.WithResource(res),
	)
	otel.SetMeterProvider(meterProvider)

	// Setup Logs
	logExporter, err := otlploghttp.New(ctx,
		otlploghttp.WithEndpoint(stripProtocol(endpoint)),
		otlploghttp.WithInsecure(),
	)
	if err != nil {
		log.Fatalf("Failed to create log exporter: %v", err)
	}
	loggerProvider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
		sdklog.WithResource(res),
	)
	global.SetLoggerProvider(loggerProvider)
	logger = loggerProvider.Logger("go-example")

	// Create counter metric
	helloCounter, err = meter.Int64Counter("hello.requests",
		metric.WithDescription("Number of hello requests"),
		metric.WithUnit("1"),
	)
	if err != nil {
		log.Fatalf("Failed to create counter: %v", err)
	}

	// Setup HTTP server
	mux := http.NewServeMux()
	mux.HandleFunc("/hello", helloHandler)

	server := &http.Server{
		Addr:    ":3001",
		Handler: mux,
	}

	// Graceful shutdown
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		fmt.Println("Server listening on :3001")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-shutdown
	fmt.Println("\nShutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown in order: server, then providers
	server.Shutdown(ctx)
	tracerProvider.Shutdown(ctx)
	meterProvider.Shutdown(ctx)
	loggerProvider.Shutdown(ctx)

	fmt.Println("Shutdown complete")
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span with attributes
	ctx, span := tracer.Start(ctx, "hello-handler")
	defer span.End()

	span.SetAttributes(
		attribute.String("http.method", r.Method),
		attribute.String("http.route", "/hello"),
	)

	// Increment counter metric
	helloCounter.Add(ctx, 1, metric.WithAttributes(
		attribute.String("endpoint", "/hello"),
	))

	// Emit log record
	record := otellog.Record{}
	record.SetTimestamp(time.Now())
	record.SetSeverity(otellog.SeverityInfo)
	record.SetBody(otellog.StringValue("Hello endpoint called"))
	logger.Emit(ctx, record)

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Hello from Go!",
	})
}

// stripProtocol removes http:// or https:// prefix from endpoint
func stripProtocol(endpoint string) string {
	if len(endpoint) > 7 && endpoint[:7] == "http://" {
		return endpoint[7:]
	}
	if len(endpoint) > 8 && endpoint[:8] == "https://" {
		return endpoint[8:]
	}
	return endpoint
}
