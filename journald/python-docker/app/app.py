"""
Journald-format log simulator — writes JSON lines to a file.

Each line uses real journald field names so the OTel Collector can parse
them with a json_parser operator and map them to the correct attributes.
"""

import json
import os
import socket
import time

MESSAGES = [
    (6, "Storage write completed: 1.2MB in 34ms"),
    (4, "Disk usage at 78%, threshold is 80%"),
    (3, "Failed to flush write buffer: timeout after 5000ms"),
]

# journald PRIORITY values: 6=info, 4=warning, 3=error

LOG_FILE = "/var/log/app/journald.log"
HOSTNAME = socket.gethostname()
PID = os.getpid()


def main():
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

    idx = 0
    while True:
        priority, message = MESSAGES[idx % len(MESSAGES)]
        record = {
            "MESSAGE": message,
            "PRIORITY": str(priority),
            "SYSLOG_IDENTIFIER": "storage-service",
            "_HOSTNAME": HOSTNAME,
            "_PID": str(PID),
            "__REALTIME_TIMESTAMP": str(int(time.time() * 1_000_000)),
            "COMPONENT": "storage",
        }
        line = json.dumps(record)

        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")

        idx += 1
        time.sleep(3)


if __name__ == "__main__":
    main()
