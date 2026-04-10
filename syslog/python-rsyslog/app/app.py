"""
Syslog demo application — writes to /dev/log (Unix socket).

rsyslog picks up these messages and forwards them over TCP to the
OpenTelemetry Collector. The application itself has no knowledge of
the collector; it just uses the standard syslog interface.
"""

import logging
import logging.handlers
import time

MESSAGES = [
    (logging.INFO, "Storage write completed: 1.2MB in 34ms"),
    (logging.WARNING, "Disk usage at 78%, threshold is 80%"),
    (logging.ERROR, "Failed to flush write buffer: timeout after 5000ms"),
]


def main():
    logger = logging.getLogger("storage-service")
    logger.setLevel(logging.DEBUG)

    handler = logging.handlers.SysLogHandler(address="/dev/log")
    handler.setFormatter(logging.Formatter("%(message)s"))
    handler.setLevel(logging.DEBUG)
    logger.addHandler(handler)

    idx = 0
    while True:
        level, message = MESSAGES[idx % len(MESSAGES)]
        logger.log(level, message)
        idx += 1
        time.sleep(3)


if __name__ == "__main__":
    main()
