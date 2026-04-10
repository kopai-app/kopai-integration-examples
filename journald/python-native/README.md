# Journald logs to Kopai (native receiver, Linux only)

## Overview

This example shows how to collect logs directly from systemd's journal using the OpenTelemetry Collector's native journald receiver. The Python application writes to stdout; systemd captures it via journald. The OTel Collector reads entries from the journal binary format and exports them via OTLP/HTTP to Kopai.

This is the recommended approach for production Linux systems with systemd. It provides richer metadata, cursor-based tracking, and handles log rotation automatically.

> **Note:** This example requires Linux with systemd. For a cross-platform alternative that works on Mac and Windows, see the [python-docker](../python-docker/) example.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Linux host                                                  │
│                                                              │
│  Python app (systemd unit)                                   │
│    │                                                         │
│    │ stdout                                                  │
│    ▼                                                         │
│  journald ──▶ /var/log/journal/ (binary)                     │
│                     │                                        │
│  otelcol-contrib    │  (journald receiver, cursor-tracked)   │
│    │◄───────────────┘                                        │
│    │                                                         │
│    │ OTLP/HTTP                                               │
│    ▼                                                         │
│  Kopai (localhost:4318)                                      │
└──────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Linux with systemd
- [Nix package manager](https://nixos.org/download.html)
- Kopai running on the host:

```bash
HOST=0.0.0.0 npx @kopai/app start
```

## Running the example

```bash
cd journald/python-native
nix develop
./run.sh
```

`nix develop` provides python3, otelcol-contrib, and nodejs. The `run.sh` script:
1. Checks for journalctl and systemd-run
2. Detects the journal directory (`/var/log/journal` or `/run/log/journal`)
3. Starts the OTel Collector in the background
4. Starts the Python app as a transient systemd unit via `systemd-run --user`
5. Prints verification commands

Press Ctrl+C to stop everything.

## Verifying it works

First, check that journald is receiving the logs:

```bash
journalctl --user --unit=journald-native-demo -f
```

Then check the collector's debug output in the terminal where `run.sh` is running. You should see log records with Body fields containing messages like "Storage write completed: 1.2MB in 34ms".

Verify logs arrived in Kopai using the CLI:

```bash
# Show timestamps and message bodies
npx @kopai/cli logs search --service journald-native-demo \
  --fields Timestamp,Body --sort ASC

# Confirm resource attributes are present (JSON output)
npx @kopai/cli logs search --service journald-native-demo --json

# Confirm error-level logs are arriving (severity-min 17 = ERROR)
npx @kopai/cli logs search --service journald-native-demo --severity-min 17 --json
```

The first command should return rows with Body values containing the storage simulation messages. The JSON output should show `service.name: "journald-native-demo"` and `deployment.environment: "native-demo"` in the resource attributes. The severity-min query should return at least one entry.

## Sending to Kopai Cloud instead

Change only the `otlphttp/kopai` exporter in `otel-collector/config.yaml`:

```yaml
# Local (default in this example)
endpoint: http://localhost:4318
tls:
  insecure: true

# Kopai Cloud — replace the above with:
endpoint: https://otlp-http.kopai.app
headers:
  authorization: "Bearer <your-api-key>"
# Remove the tls: insecure: true block entirely
```

See https://docs.kopai.app/authentication/ for API key setup.

## Filelog + json_parser vs native journald receiver

The [python-docker](../python-docker/) example uses the filelog receiver with a `json_parser` to process journald-format JSON exported to a file. This example uses the native journald receiver. Here's when to use each:

### Metadata richness

The native journald receiver reads the binary journal format directly and has access to **all** journald fields automatically — including trusted fields like `_TRANSPORT`, `_SYSTEMD_UNIT`, `_BOOT_ID`, `_MACHINE_ID`, `_SYSTEMD_CGROUP`, and dozens more that journald adds transparently. The filelog approach only sees fields that were explicitly written to the JSON file.

### Cursor tracking

The journald receiver uses journald's native cursor mechanism to track its read position. This survives collector restarts with no duplicate or lost entries. The filelog receiver tracks position by byte offset in the file — if the file is rotated or truncated between restarts, lines can be lost or duplicated.

### Log rotation

journald handles its own rotation internally (controlled by `SystemMaxUse`, `MaxRetentionSec`, etc. in `journald.conf`). The journald receiver follows this automatically. With the filelog approach, you must configure `RotatingFileHandler` or `logrotate` yourself, and ensure the collector's `include` pattern matches rotated files.

### When to use each

| Scenario | Recommended approach |
|----------|---------------------|
| Linux host with systemd | **Native journald receiver** (this example) |
| Docker/Kubernetes, any OS | **Filelog + json_parser** (python-docker example) |
| Existing JSON log files | **Filelog + json_parser** |
| Need all journald metadata | **Native journald receiver** |
| CI/CD pipelines, dev environments | **Filelog + json_parser** (simpler setup) |

## Adapting to your own setup

To collect logs from an existing systemd service, change the `units` filter in `otel-collector/config.yaml`:

```yaml
receivers:
  journald:
    directory: /var/log/journal
    units:
      - your-service-name
      - another-service
```

To collect all journal entries (not filtered by unit):

```yaml
receivers:
  journald:
    directory: /var/log/journal
```

The collector can run as a systemd service itself. Create a unit file at `/etc/systemd/system/otelcol-contrib.service` and point it at your config.

## Troubleshooting

**"journalctl not found" or "systemd-run not found":**

This example requires Linux with systemd. If you're on Mac, Windows, or a container without systemd, use the [python-docker](../python-docker/) example instead.

**Collector starts but no logs appear:**

Check that the Python app is writing to journald:

```bash
journalctl --user --unit=journald-native-demo --no-pager -n 5
```

If no entries appear, the systemd unit may have failed to start. Check with:

```bash
systemctl --user status journald-native-demo
```

**"Permission denied" reading the journal:**

The OTel Collector needs read access to the journal directory. Either run as root, or add your user to the `systemd-journal` group:

```bash
sudo usermod -aG systemd-journal $USER
```

Log out and back in for the group change to take effect.

**Logs appear in the collector but not in Kopai:**

Verify Kopai is running and listening:

```bash
curl -s http://localhost:4318/v1/logs
```

If this returns a connection error, restart Kopai with `HOST=0.0.0.0 npx @kopai/app start`.
