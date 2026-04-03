# Syslog direct to Kopai via rsyslog omotel

## Overview

This example shows how to export syslog messages directly from rsyslog to Kopai using the native `omotel` output module — no OpenTelemetry Collector required. rsyslog reads from `/dev/log`, converts the messages to OTLP format, and sends them over HTTP to Kopai's OTLP endpoint. This is the simplest possible syslog-to-OTLP pipeline: one daemon, zero middleware.

The `omotel` module was added to rsyslog in late 2025 and is not yet available as a distribution package. This example builds rsyslog from source with `--enable-omotel=yes`. The first build takes ~5 minutes; subsequent builds are cached.

> **Note:** The `omotel` module was announced as "omotlp" in the [rsyslog blog post](https://www.rsyslog.com/native-opentelemetry-export-arrives-introducing-the-omotlp-output-module/), but the actual module name is `omotel`. See the [implementation PR](https://github.com/rsyslog/rsyslog/pull/6338) for technical details.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Docker Compose                                  │
│                                                  │
│  ┌────────────────────────────┐                  │
│  │  app container              │                  │
│  │                             │                  │
│  │  Python app                 │                  │
│  │    │                        │                  │
│  │    │ /dev/log (Unix socket) │                  │
│  │    ▼                        │                  │
│  │  rsyslog + omotel module    │                  │
│  │    │                        │                  │
│  │    │ OTLP/HTTP (JSON)       │                  │
│  └────┼───────────────────────┘                  │
│       │                                          │
└───────┼──────────────────────────────────────────┘
        │
        ▼
  ┌──────────┐
  │  Kopai   │
  │  (host)  │
  └──────────┘
```

Compare this to the `python-rsyslog` example which requires an OTel Collector between rsyslog and Kopai. Here, rsyslog speaks OTLP natively.

## Prerequisites

- Docker and Docker Compose
- Node.js (for Kopai CLI)
- Kopai running on the host:

```bash
HOST=0.0.0.0 npx @kopai/app start
```

## Running the example

```bash
cd syslog/rsyslog-omotel
docker compose up --build
```

The first build compiles rsyslog from source (~5 min). Subsequent builds use Docker's layer cache. The app starts logging every 3 seconds.

To run in the background:

```bash
docker compose up --build -d
```

To stop:

```bash
docker compose down
```

## Verifying it works

Since there is no OTel Collector in this example, there is no debug exporter to check. Verify directly with the Kopai CLI.

The omotel module sets the OTLP SDK service name to `rsyslog` (its own identity), while our custom `service.name` appears in the resource attributes. Use `--service rsyslog` for CLI queries:

```bash
# Show timestamps and message bodies
npx @kopai/cli logs search --service rsyslog \
  --fields Timestamp,Body --sort ASC

# Confirm resource attributes are present (JSON output)
npx @kopai/cli logs search --service rsyslog --json

# Confirm error-level logs are arriving (severity-min 17 = ERROR)
npx @kopai/cli logs search --service rsyslog --severity-min 17 --json
```

The first command should return rows with Body values containing the storage simulation messages. The JSON output should show `service.name: "syslog-omotel-demo"` and `deployment.environment: "docker-compose-demo"` in the resource attributes. The severity-min query should return at least one entry.

## Sending to Kopai Cloud instead

Change only the `endpoint` and add authentication in `rsyslog.conf`:

```
# Local (default in this example)
*.* action(
    type="omotel"
    endpoint="http://host.docker.internal:4318"
    ...
)

# Kopai Cloud — replace with:
*.* action(
    type="omotel"
    endpoint="https://otlp-http.kopai.app"
    bearer_token="<your-api-key>"
    ...
)
```

When using Kopai Cloud, also remove the `extra_hosts` block from `docker-compose.yml`.

See https://docs.kopai.app/authentication/ for API key setup.

## Adapting to your own setup

This approach is ideal when you want the simplest possible pipeline and are comfortable running a recent rsyslog build. Once distribution packages ship the `omotel` module, the setup becomes:

1. Install the `rsyslog-omotel` package (name TBD by your distribution)
2. Add to `/etc/rsyslog.conf`:

```
module(load="omotel")

template(name="msg-only" type="string" string="%syslogtag%%msg:::drop-last-lf%")

*.* action(
    type="omotel"
    endpoint="http://your-kopai-host:4318"
    path="/v1/logs"
    protocol="http/json"
    template="msg-only"
    resource="{ \"service.name\": \"my-service\", \"deployment.environment\": \"production\" }"
)
```

3. Restart rsyslog:

```bash
sudo systemctl restart rsyslog
```

No OTel Collector, no sidecar, no additional infrastructure.

The module also supports `http/protobuf` encoding with gzip compression for lower bandwidth usage in production:

```
*.* action(
    type="omotel"
    endpoint="http://your-kopai-host:4318"
    protocol="http/protobuf"
    compression="gzip"
    ...
)
```

## Troubleshooting

**Build fails during `autoreconf` or `configure`:**

The Dockerfile builds from the rsyslog `main` branch (the omotel module is not in any tagged release yet). If the build breaks due to upstream changes, pin to a specific commit by changing `RSYSLOG_BRANCH` in the Dockerfile.

**rsyslog starts but no logs appear in Kopai:**

Check that rsyslog loaded the omotel module successfully:

```bash
docker compose logs app 2>&1 | grep -i omotel
```

If you see "could not load module 'omotel'", the build did not produce the module. Rebuild with `docker compose build --no-cache`.

**"Connection refused" errors in rsyslog output:**

Verify Kopai is running on the host and accessible from the container:

```bash
docker compose exec app python3 -c "import urllib.request; urllib.request.urlopen('http://host.docker.internal:4318/v1/logs')"
```

A 404 response is expected (the endpoint requires POST). A connection error means Kopai is not reachable — ensure it was started with `HOST=0.0.0.0`.

**Logs arrive but with no severity or wrong resource attributes:**

Check `rsyslog.conf` for the `resource` JSON — it must be valid JSON. Use `rsyslogd -N1` inside the container to validate the config:

```bash
docker compose exec app rsyslogd -N1
```
