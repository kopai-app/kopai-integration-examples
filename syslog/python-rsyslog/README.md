# Syslog via rsyslog to Kopai

## Overview

This example shows how to collect syslog messages from an application that writes to `/dev/log` — the standard Unix syslog socket — and forward them through rsyslog and the OpenTelemetry Collector to Kopai. The application requires zero code changes; rsyslog handles all forwarding. This mirrors a real-world migration where you have an existing Debian/Ubuntu host with applications that already log via syslog.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Docker Compose                                     │
│                                                     │
│  ┌───────────────────────┐                          │
│  │  app container         │                          │
│  │                        │                          │
│  │  Python app            │                          │
│  │    │                   │                          │
│  │    │ /dev/log (Unix)   │                          │
│  │    ▼                   │                          │
│  │  rsyslog ──────────────┼── TCP:54527 (RFC 3164) ─┐│
│  └───────────────────────┘                          ││
│                                                     ││
│  ┌───────────────────────┐                          ││
│  │  otel-collector        │◄─────────────────────────┘│
│  │                        │                          │
│  │  syslog receiver       │                          │
│  │    │                   │                          │
│  │    ▼                   │                          │
│  │  OTLP/HTTP exporter ──┼───────────────────────┐  │
│  └───────────────────────┘                       │  │
│                                                   │  │
└───────────────────────────────────────────────────┼──┘
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
cd syslog/python-rsyslog
docker compose up --build
```

The app starts logging every 3 seconds. You should see the OTel Collector's debug exporter printing log entries in the terminal output.

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
npx @kopai/cli logs search --service syslog-rsyslog-demo \
  --fields Timestamp,Body --sort ASC

# Confirm resource attributes are present (JSON output)
npx @kopai/cli logs search --service syslog-rsyslog-demo --json

# Confirm error-level logs are arriving (severity-min 17 = ERROR)
npx @kopai/cli logs search --service syslog-rsyslog-demo --severity-min 17 --json
```

The first command should return rows with Body values containing the storage simulation messages. The JSON output should show `service.name: "syslog-rsyslog-demo"` and `deployment.environment: "docker-compose-demo"` in the resource attributes. The severity-min query should return at least one entry.

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

**Scenario A — existing rsyslog on a Debian/Ubuntu host:**

Add one rule to `/etc/rsyslog.conf` (no other changes needed):

```
*.* action(type="omfwd" target="127.0.0.1" port="54527" protocol="tcp"
           action.resumeRetryCount="10"
           queue.type="linkedList" queue.size="10000")
```

Then run the OTel Collector with the `config.yaml` from this example, changing the endpoint to your Kopai instance. Restart rsyslog:

```bash
sudo systemctl restart rsyslog
```

**Scenario B — application uses syslog(3) calls directly** (C/C++, Java with a syslog appender, etc.):

The same rsyslog rule applies. The application needs no modification whatsoever — it already writes to `/dev/log`, and rsyslog already reads from it.

## Troubleshooting

**No logs appear in the collector's debug output:**

Check that both rsyslog and the Python app are running inside the container:

```bash
docker compose logs app
```

You should see supervisor reporting both `rsyslog` and `app` as `RUNNING`. If rsyslog failed to start, the log will show the error.

**Logs appear in the collector but not in Kopai:**

Verify Kopai is running on the host and listening on port 4318:

```bash
curl -s http://localhost:4318/v1/logs
```

If this returns a connection error, restart Kopai with `HOST=0.0.0.0 npx @kopai/app start`.

**"Connection refused" errors in rsyslog:**

rsyslog starts before the collector is ready to accept connections. The retry queue handles this — rsyslog will buffer messages and retry. Wait 10–15 seconds and check again.

**Duplicate or missing messages after container restart:**

rsyslog's in-memory queue does not survive container restarts. Messages buffered during a restart window are lost. For production use, configure rsyslog's disk-assisted queue (`queue.filename` and `queue.saveonshutdown="on"`).
