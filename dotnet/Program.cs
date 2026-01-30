// Minimal .NET OpenTelemetry example with ASP.NET Core.
using System.Diagnostics.Metrics;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

// Get configuration from environment
var endpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT") ?? "http://localhost:4318";
var serviceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "dotnet-example";

Console.WriteLine($"Starting server with OTEL endpoint: {endpoint}");
Console.WriteLine($"Service name: {serviceName}");

// Create custom meter for metrics
var meter = new Meter(serviceName);
var helloCounter = meter.CreateCounter<long>("hello.requests", "1", "Number of hello requests");

// Configure OpenTelemetry resource
var resourceBuilder = ResourceBuilder.CreateDefault()
    .AddService(serviceName);

// Setup Traces and Metrics
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService(serviceName))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddOtlpExporter(opts =>
        {
            opts.Endpoint = new Uri($"{endpoint}/v1/traces");
            opts.Protocol = OtlpExportProtocol.HttpProtobuf;
        }))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddMeter(serviceName)
        .AddOtlpExporter(opts =>
        {
            opts.Endpoint = new Uri($"{endpoint}/v1/metrics");
            opts.Protocol = OtlpExportProtocol.HttpProtobuf;
        }));

// Setup Logs
builder.Logging.AddOpenTelemetry(logging =>
{
    logging.SetResourceBuilder(resourceBuilder);
    logging.AddOtlpExporter(opts =>
    {
        opts.Endpoint = new Uri($"{endpoint}/v1/logs");
        opts.Protocol = OtlpExportProtocol.HttpProtobuf;
    });
});

var app = builder.Build();

// Single /hello endpoint
app.MapGet("/hello", (ILogger<Program> logger) =>
{
    // Increment counter metric
    helloCounter.Add(1, new KeyValuePair<string, object?>("endpoint", "/hello"));

    // Log a message (automatically exported via OpenTelemetry)
    logger.LogInformation("Hello endpoint called");

    // Return JSON response (trace is automatic via ASP.NET Core instrumentation)
    return Results.Json(new { message = "Hello from .NET!" });
});

// Configure port
app.Urls.Add("http://0.0.0.0:3001");

Console.WriteLine("Server listening on :3001");

app.Run();
