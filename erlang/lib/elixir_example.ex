defmodule ElixirExample.Application do
  use Application
  require OpenTelemetry.Tracer, as: Tracer

  def start(_type, _args) do
    endpoint = System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
    service_name = System.get_env("OTEL_SERVICE_NAME", "elixir-example")

    IO.puts("Starting server with OTEL endpoint: #{endpoint}")
    IO.puts("Service name: #{service_name}")

    # Initialize OpenTelemetry Cowboy instrumentation for automatic span creation
    :opentelemetry_cowboy.setup()

    IO.puts("OpenTelemetry SDK configured")
    IO.puts("Server listening on :3001")

    # Initialize ETS table for request counter (for metrics demo)
    :ets.new(:request_counter, [:named_table, :public, :set])

    children = [
      {Plug.Cowboy, scheme: :http, plug: ElixirExample.Router, options: [port: 3001]}
    ]

    opts = [strategy: :one_for_one, name: ElixirExample.Supervisor]
    Supervisor.start_link(children, opts)
  end
end

defmodule ElixirExample.Router do
  use Plug.Router
  require OpenTelemetry.Tracer, as: Tracer

  plug(:match)
  plug(:dispatch)

  get "/hello" do
    endpoint = System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
    service_name = System.get_env("OTEL_SERVICE_NAME", "elixir-example")

    # Create a custom span using the SDK
    Tracer.with_span "process_hello" do
      Tracer.set_attributes([
        {"http.method", "GET"},
        {"http.route", "/hello"},
        {"custom.processed", true}
      ])

      # Increment and send metric (using direct OTLP HTTP as Elixir metrics SDK is limited)
      count = :ets.update_counter(:request_counter, :hello, 1, {:hello, 0})
      send_metric("hello.requests", count, endpoint, service_name, %{"endpoint" => "/hello"})

      # Send log (using direct OTLP HTTP as Elixir logs SDK is limited)
      send_log("Hello endpoint called", endpoint, service_name)
    end

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(%{message: "Hello from Elixir!"}))
  end

  match _ do
    send_resp(conn, 404, "Not found")
  end

  # Direct OTLP HTTP for logs (SDK logs exporter not widely available in Elixir)
  defp send_log(message, endpoint, service_name) do
    timestamp = System.system_time(:nanosecond)

    body = %{
      resourceLogs: [%{
        resource: %{
          attributes: [
            %{key: "service.name", value: %{stringValue: service_name}},
            %{key: "telemetry.sdk.language", value: %{stringValue: "elixir"}}
          ]
        },
        scopeLogs: [%{
          scope: %{name: service_name},
          logRecords: [%{
            timeUnixNano: to_string(timestamp),
            severityText: "INFO",
            body: %{stringValue: message}
          }]
        }]
      }]
    }

    send_otlp_request("#{endpoint}/v1/logs", body)
  end

  # Direct OTLP HTTP for metrics (SDK metrics exporter not widely available in Elixir)
  defp send_metric(name, value, endpoint, service_name, attributes) do
    timestamp = System.system_time(:nanosecond)

    attrs = Enum.map(attributes, fn {k, v} ->
      %{key: k, value: %{stringValue: v}}
    end)

    body = %{
      resourceMetrics: [%{
        resource: %{
          attributes: [
            %{key: "service.name", value: %{stringValue: service_name}},
            %{key: "telemetry.sdk.language", value: %{stringValue: "elixir"}}
          ]
        },
        scopeMetrics: [%{
          scope: %{name: service_name},
          metrics: [%{
            name: name,
            description: "Number of hello requests",
            unit: "1",
            sum: %{
              dataPoints: [%{
                asInt: to_string(value),
                timeUnixNano: to_string(timestamp),
                attributes: attrs
              }],
              aggregationTemporality: 2,
              isMonotonic: true
            }
          }]
        }]
      }]
    }

    send_otlp_request("#{endpoint}/v1/metrics", body)
  end

  defp send_otlp_request(url, body) do
    url_charlist = String.to_charlist(url)
    json_body = Jason.encode!(body)

    :httpc.request(
      :post,
      {url_charlist, [{~c"content-type", ~c"application/json"}], ~c"application/json", json_body},
      [{:timeout, 5000}],
      []
    )
  rescue
    _ -> :ok
  end
end
