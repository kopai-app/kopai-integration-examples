"""
Journald demo application — writes to stdout.

When run as a systemd service (or via systemd-run), journald captures
stdout automatically. The OTel Collector's native journald receiver
reads the entries directly from the journal.
"""

import time

MESSAGES = [
    ("6", "Storage write completed: 1.2MB in 34ms"),
    ("4", "Disk usage at 78%, threshold is 80%"),
    ("3", "Failed to flush write buffer: timeout after 5000ms"),
]

# Prefix lines with <priority> so systemd can parse severity.
# See sd-daemon(3) for the prefix convention.


def main():
    idx = 0
    while True:
        priority, message = MESSAGES[idx % len(MESSAGES)]
        print(f"<{priority}>{message}", flush=True)
        idx += 1
        time.sleep(3)


if __name__ == "__main__":
    main()
