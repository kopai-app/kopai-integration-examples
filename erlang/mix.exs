defmodule ElixirExample.MixProject do
  use Mix.Project

  def project do
    [
      app: :elixir_example,
      version: "0.1.0",
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :inets, :ssl],
      mod: {ElixirExample.Application, []}
    ]
  end

  defp deps do
    [
      # Web framework
      {:plug_cowboy, "~> 2.6"},
      {:jason, "~> 1.4"},

      # OpenTelemetry SDK
      {:opentelemetry_api, "~> 1.4"},
      {:opentelemetry, "~> 1.5"},
      {:opentelemetry_exporter, "~> 1.8"},
      {:opentelemetry_cowboy, "~> 1.0"}
    ]
  end
end
