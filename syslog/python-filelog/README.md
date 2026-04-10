# Syslog from file to Kopai (filelog receiver)

## Overview

This example shows how to collect syslog-formatted log lines from a plain file on disk. The Python application writes RFC 3164 lines to `/var/log/app.log`. The OpenTelemetry Collector tails that file using the filelog receiver with a `syslog_parser` operator, then exports the parsed log records via OTLP/HTTP to Kopai. No syslog daemon or socket is involved — just a file and a file reader.

> **Note:** The custom `RFC3164Formatter` in `app.py` exists to demonstrate the collector's `syslog_parser` operator. In practice, most applications write plain text or JSON to log files. If your app does that, replace `syslog_parser` with `regex_parser` or `json_parser` in the collector config.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Docker Compose                                           │
│                                                           │
│  ┌──────────────────┐     shared volume: app-logs         │
│  │  app container     │     mounted at /var/log             │
│  │                    │                                     │
│  │  Python app ───────┼──▶ /var/log/app.log                │
│  └──────────────────┘                                     │
│                              │                             │
│  ┌──────────────────┐        │ (filelog receiver tails)    │
│  │  otel-collector    │◄───────┘                            │
│  │                    │                                     │
│  │  syslog_parser     │                                     │
│  │    │               │                                     │
│  │    ▼               │                                     │
│  │  OTLP/HTTP ────────┼──────────────────────────────┐     │
│  └──────────────────┘                                │     │
│                                                       │     │
└───────────────────────────────────────────────────────┼─────┘
                                                        │
                                                        ▼
                                                  ┌──────────┐
                                                  │  Kopai   │
                                                  │  (host)  │
                                                  └──────────┘
```

## Prerequisites

- Docker and Docker Compose
- Node.js (for Kopai CLI)
- Kopai running on the host:

```bash
HOST=0.0.0.0 npx @kopai/app start
```

## Running the example

```bash
cd syslog/python-filelog
docker compose up --build
```

The app starts writing RFC 3164 syslog lines to `/var/log/app.log` every 3 seconds. The collector tails the file and prints parsed log records via the debug exporter.

To run in the background:

```bash
docker compose up --build -d
```

To stop:

```bash
docker compose down
```

## Verifying it works

First, check the collector's debug output for log entries:

```bash
docker compose logs otel-collector
```

You should see log records with Body fields containing messages like "Storage write completed: 1.2MB in 34ms".

Then verify logs arrived in Kopai using the CLI:

```bash
# Show timestamps and message bodies
npx @kopai/cli logs search --service syslog-filelog-demo \
  --fields Timestamp,Body --sort ASC

# Confirm resource attributes are present (JSON output)
npx @kopai/cli logs search --service syslog-filelog-demo --json

# Confirm error-level logs are arriving (severity-min 17 = ERROR)
npx @kopai/cli logs search --service syslog-filelog-demo --severity-min 17 --json
```

The first command should return rows with Body values containing the storage simulation messages. The JSON output should show `service.name: "syslog-filelog-demo"` and `deployment.environment: "docker-compose-demo"` in the resource attributes. The severity-min query should return at least one entry.

## Sending to Kopai Cloud instead

To send to Kopai Cloud instead of a local instance, change only the `otlphttp/kopai` exporter in `otel-collector/config.yaml`:

```yaml
# Local (default in this example)
endpoint: http://host.docker.internal:4318
tls:
  insecure: true

# Kopai Cloud — replace the above with:
endpoint: https://otlp-http.kopai.app
headers:
  authorization: "Bearer <your-api-key>"
# Remove the tls: insecure: true block entirely
```

When using Kopai Cloud, also remove the `extra_hosts` block from `docker-compose.yml` — the collector no longer needs to reach the host.

See https://docs.kopai.app/authentication/ for API key setup.

## Adapting to your own setup

This pattern applies when the application writes to a log file on disk and you cannot change where or how it writes.

The OTel Collector can be run as a systemd service on the same host, pointing at the real log file path — no Docker volume needed. Change the `include` field in `config.yaml`:

```yaml
receivers:
  filelog:
    include: [/var/log/myapp/*.log]
```

The filelog receiver tracks its read position across restarts using a storage extension. If you need durability guarantees (no duplicate or lost lines after a collector restart), configure the `file_storage` extension. See the [OTel Collector filelog receiver docs](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/filelogreceiver) for the storage config.

The `syslog_parser` operator expects well-formed RFC 3164 lines. If the application writes a different format, replace `syslog_parser` with `regex_parser` or `json_parser` as appropriate.

## Troubleshooting

**No logs appear in the collector's debug output:**

Check that the log file is being written to and that the shared volume is working:

```bash
docker compose exec app cat /var/log/app.log | tail -5
```

You should see RFC 3164 formatted lines. If the file is empty or missing, the Python app is not writing to it. If the collector still shows no logs, the shared volume mount may be misconfigured — verify both services mount the `app-logs` volume in `docker-compose.yml`.

**Logs appear in the collector but not in Kopai:**

Verify Kopai is running on the host and listening on port 4318:

```bash
curl -s http://localhost:4318/v1/logs
```

If this returns a connection error, restart Kopai with `HOST=0.0.0.0 npx @kopai/app start`.

**Parser errors in the collector logs:**

The `syslog_parser` expects valid RFC 3164 format: `<priority>Mmm DD HH:MM:SS hostname app[pid]: message`. If your application writes a different format, the parser will fail. Check a sample line from the log file and adjust the parser accordingly.

**Logs are duplicated after collector restart:**

By default, the filelog receiver stores its checkpoint in memory. If the collector restarts, it re-reads from `start_at: beginning`. For production, add a `file_storage` extension to persist the checkpoint to disk.
