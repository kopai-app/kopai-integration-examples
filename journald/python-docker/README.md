# Journald-format logs to Kopai (Docker, cross-platform)

## Overview

This example shows how to collect journald-format JSON logs and send them to Kopai via the OpenTelemetry Collector. The Python application writes JSON lines using real journald field names (`MESSAGE`, `PRIORITY`, `SYSLOG_IDENTIFIER`, etc.) to a file on a shared Docker volume. The OTel Collector tails that file using the filelog receiver with a `json_parser` operator chain that maps journald fields to OTel attributes.

This approach works on Linux, Mac, and Windows — no systemd or journald required. The app simulates what journald's JSON export format looks like, making it useful for developing and testing journald log pipelines without a Linux host.

> **Note:** If you're on Linux with systemd, see the [python-native](../python-native/) example which uses the OTel Collector's native journald receiver for richer metadata and cursor-based tracking.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Docker Compose                                           │
│                                                           │
│  ┌──────────────────┐     shared volume: app-logs         │
│  │  app container     │     mounted at /var/log/app         │
│  │                    │                                     │
│  │  Python app ───────┼──▶ /var/log/app/journald.log       │
│  │  (JSON lines)      │     (journald field names)          │
│  └──────────────────┘                                     │
│                              │                             │
│  ┌──────────────────┐        │ (filelog receiver tails)    │
│  │  otel-collector    │◄───────┘                            │
│  │                    │                                     │
│  │  json_parser       │                                     │
│  │  severity_parser   │                                     │
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
cd journald/python-docker
docker compose up --build
```

The app starts writing journald-format JSON lines every 3 seconds. The collector parses them and prints log records via the debug exporter.

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
npx @kopai/cli logs search --service journald-docker-demo \
  --fields Timestamp,Body --sort ASC

# Confirm resource attributes are present (JSON output)
npx @kopai/cli logs search --service journald-docker-demo --json

# Confirm error-level logs are arriving (severity-min 17 = ERROR)
npx @kopai/cli logs search --service journald-docker-demo --severity-min 17 --json
```

The first command should return rows with Body values containing the storage simulation messages. The JSON output should show `service.name: "journald-docker-demo"` and `deployment.environment: "docker-compose-demo"` in the resource attributes. The severity-min query should return at least one entry.

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

This pattern is useful when you need to process journald-exported JSON files. Real journald logs can be exported with:

```bash
journalctl -o json --follow > /var/log/app/journald.log
```

Point the collector's filelog receiver at that file and the same `json_parser` chain will work. Adjust the field mappings in `config.yaml` if your journald export includes additional fields you want to preserve.

For production on Linux, consider the [python-native](../python-native/) example which uses the OTel Collector's native journald receiver instead of file tailing. It provides cursor-based tracking (no duplicate or lost lines across restarts) and access to all journald metadata fields automatically.

## Troubleshooting

**No logs appear in the collector's debug output:**

Check that the log file is being written to and that the shared volume is working:

```bash
docker compose exec app cat /var/log/app/journald.log | tail -3
```

You should see JSON lines with journald field names. If the file is empty, the Python app is not writing to it.

**Logs appear in the collector but not in Kopai:**

Verify Kopai is running on the host and listening on port 4318:

```bash
curl -s http://localhost:4318/v1/logs
```

If this returns a connection error, restart Kopai with `HOST=0.0.0.0 npx @kopai/app start`.

**Parser errors in the collector logs:**

The `json_parser` expects valid JSON on each line. Check a sample line:

```bash
docker compose exec app head -1 /var/log/app/journald.log | python3 -m json.tool
```

If parsing fails, the line is malformed. Check the Python app's output format.

**Severity levels not mapping correctly:**

The `severity_parser` maps journald PRIORITY values (3=error, 4=warning, 6=info) to OTel severity. If you see unexpected severity levels, check that PRIORITY is a string in the JSON (not an integer) — the severity_parser matches string values.
