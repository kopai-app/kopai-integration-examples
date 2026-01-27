import Config

# OpenTelemetry runtime configuration
otel_endpoint = System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
service_name = System.get_env("OTEL_SERVICE_NAME", "elixir-example")

config :opentelemetry,
  resource: [
    service: [
      name: service_name,
      namespace: "kopai-examples"
    ]
  ]

config :opentelemetry_exporter,
  otlp_endpoint: otel_endpoint
