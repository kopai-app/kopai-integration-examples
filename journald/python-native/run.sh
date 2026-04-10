#!/usr/bin/env bash
set -euo pipefail

# ── Preflight checks ──────────────────────────────────────────────

if ! command -v journalctl &> /dev/null; then
  echo "ERROR: journalctl not found. This example requires Linux with systemd."
  echo "For a cross-platform alternative, see ../python-docker/"
  exit 1
fi

if ! command -v systemd-run &> /dev/null; then
  echo "ERROR: systemd-run not found. This example requires systemd."
  exit 1
fi

if ! command -v otelcol-contrib &> /dev/null; then
  echo "ERROR: otelcol-contrib not found. Run 'nix develop' first."
  exit 1
fi

# ── Detect journal directory ──────────────────────────────────────

if [ -d /var/log/journal ]; then
  JOURNAL_DIR="/var/log/journal"
elif [ -d /run/log/journal ]; then
  JOURNAL_DIR="/run/log/journal"
else
  echo "ERROR: No journal directory found at /var/log/journal or /run/log/journal"
  exit 1
fi
echo "Using journal directory: $JOURNAL_DIR"
export JOURNAL_DIR

# ── Cleanup on exit ───────────────────────────────────────────────

COLLECTOR_PID=""
APP_UNIT="journald-native-demo"

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "$COLLECTOR_PID" ] && kill -0 "$COLLECTOR_PID" 2>/dev/null; then
    kill "$COLLECTOR_PID" 2>/dev/null || true
    wait "$COLLECTOR_PID" 2>/dev/null || true
  fi
  systemctl --user stop "$APP_UNIT" 2>/dev/null || true
  systemctl --user reset-failed "$APP_UNIT" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT

# ── Start OTel Collector ──────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting OTel Collector..."
otelcol-contrib --config "$SCRIPT_DIR/otel-collector/config.yaml" &
COLLECTOR_PID=$!
sleep 2

if ! kill -0 "$COLLECTOR_PID" 2>/dev/null; then
  echo "ERROR: OTel Collector failed to start. Check the config."
  exit 1
fi
echo "OTel Collector running (PID $COLLECTOR_PID)"

# ── Start Python app via systemd-run ──────────────────────────────

echo "Starting Python app as systemd unit '$APP_UNIT'..."
systemd-run --user \
  --unit="$APP_UNIT" \
  --property=SyslogIdentifier=storage-service \
  python3 "$SCRIPT_DIR/app.py"

sleep 2
if systemctl --user is-active "$APP_UNIT" &>/dev/null; then
  echo "Python app running as '$APP_UNIT'"
else
  echo "ERROR: Python app failed to start."
  journalctl --user --unit="$APP_UNIT" --no-pager -n 10
  exit 1
fi

# ── Print verification commands ───────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Logs are flowing. Verify with:"
echo ""
echo "  # Check journald is receiving logs"
echo "  journalctl --user --unit=$APP_UNIT -f"
echo ""
echo "  # Check logs in Kopai"
echo "  npx @kopai/cli logs search --service journald-native-demo \\"
echo "    --fields Timestamp,Body --sort ASC"
echo ""
echo "  npx @kopai/cli logs search --service journald-native-demo --json"
echo ""
echo "  npx @kopai/cli logs search --service journald-native-demo \\"
echo "    --severity-min 17 --json"
echo ""
echo "  Press Ctrl+C to stop."
echo "════════════════════════════════════════════════════════"

# Wait for collector (foreground process)
wait "$COLLECTOR_PID"
