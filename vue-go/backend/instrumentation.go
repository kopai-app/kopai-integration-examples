package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// setupOTel wires up OTLP exporters for traces, metrics, and logs.
//
// All exporter configuration — endpoint, headers (auth), TLS — is taken from
// the standard OTEL_EXPORTER_OTLP_* env vars by the SDK itself. To send to
// local Kopai, set:
//
//	OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
//	OTEL_EXPORTER_OTLP_INSECURE=true
//
// To send to Kopai cloud, set:
//
//	OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-http.kopai.app
//	OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <backend token>
//
// service.name comes from OTEL_SERVICE_NAME via resource.Default(). The
// returned shutdown closure MUST be called before the process exits, or
// batched-but-unsent telemetry is lost.
func setupOTel(ctx context.Context) (func(context.Context) error, error) {
	// ---------- Resource ----------
	// Identifies *who* is emitting telemetry. Every span, metric, and log
	// gets these attributes attached automatically. resource.Default()
	// reads OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES from env.
	res, err := resource.Merge(
		resource.Default(),
		resource.NewSchemaless(
			attribute.String("service.version", "0.1.0"),
			attribute.String("deployment.environment", "docker-compose"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("resource: %w", err)
	}

	// ---------- Traces ----------
	// otlptracehttp.New picks up OTEL_EXPORTER_OTLP_* env vars. The
	// TracerProvider holds the resource + a Batcher that buffers spans and
	// flushes them in the background (keeps request paths cheap).
	// SetTracerProvider makes it the global so otel.Tracer("name") anywhere
	// in the app returns a tracer wired to this exporter.
	traceExp, err := otlptracehttp.New(ctx)
	if err != nil {
		return nil, fmt.Errorf("trace exporter: %w", err)
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExp),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)

	// ---------- Propagator ----------
	// Reads/writes trace context on HTTP headers. TraceContext = W3C
	// `traceparent`/`tracestate`, the same one the browser SDK injects on
	// /api/* calls. Without this, otelhttp would NOT pick up the browser's
	// traceparent and the browser + server spans would be disconnected
	// traces.
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// ---------- Metrics ----------
	// PeriodicReader runs the exporter every 5s and pushes accumulated
	// counters/histograms. Lower the interval if you want metrics to show
	// up faster during development.
	metricExp, err := otlpmetrichttp.New(ctx)
	if err != nil {
		return nil, fmt.Errorf("metric exporter: %w", err)
	}
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExp,
			sdkmetric.WithInterval(5*time.Second),
		)),
		sdkmetric.WithResource(res),
	)
	otel.SetMeterProvider(mp)

	// ---------- Logs ----------
	// Log equivalent of the trace setup. Logs emitted with a ctx that has
	// an active span are auto-correlated by trace_id + span_id, so a single
	// click in the browser → one trace → all the log lines emitted along it
	// in Kopai.
	logExp, err := otlploghttp.New(ctx)
	if err != nil {
		return nil, fmt.Errorf("log exporter: %w", err)
	}
	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)),
		sdklog.WithResource(res),
	)
	global.SetLoggerProvider(lp)

	// ---------- Shutdown ----------
	// Flush all three providers before exit so batchers drain their
	// in-memory queues. main() wires this to SIGINT/SIGTERM.
	shutdown := func(ctx context.Context) error {
		var errs []string
		if err := tp.Shutdown(ctx); err != nil {
			errs = append(errs, "tracer: "+err.Error())
		}
		if err := mp.Shutdown(ctx); err != nil {
			errs = append(errs, "meter: "+err.Error())
		}
		if err := lp.Shutdown(ctx); err != nil {
			errs = append(errs, "logger: "+err.Error())
		}
		if len(errs) > 0 {
			return fmt.Errorf("otel shutdown: %s", strings.Join(errs, "; "))
		}
		return nil
	}
	return shutdown, nil
}
