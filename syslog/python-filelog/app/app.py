"""
Syslog demo application — writes RFC 3164 formatted lines to a log file.

The OpenTelemetry Collector tails this file using the filelog receiver
with a syslog_parser operator. No syslog daemon is involved.
"""

import logging
import logging.handlers
import socket
import time

MESSAGES = [
    (logging.INFO, "Storage write completed: 1.2MB in 34ms"),
    (logging.WARNING, "Disk usage at 78%, threshold is 80%"),
    (logging.ERROR, "Failed to flush write buffer: timeout after 5000ms"),
]

# Syslog severity mapping (RFC 3164)
SYSLOG_SEVERITY = {
    logging.DEBUG: 7,
    logging.INFO: 6,
    logging.WARNING: 4,
    logging.ERROR: 3,
    logging.CRITICAL: 2,
}

FACILITY_USER = 1


class RFC3164Formatter(logging.Formatter):
    """Produces RFC 3164 syslog lines: <priority>Mmm DD HH:MM:SS hostname app[pid]: message"""

    def __init__(self):
        super().__init__()
        self.hostname = socket.gethostname()

    def format(self, record):
        severity = SYSLOG_SEVERITY.get(record.levelno, 6)
        priority = (FACILITY_USER << 3) | severity
        lt = time.localtime(record.created)
        # RFC 3164 requires space-padded day: "Apr  1" not "Apr 01"
        day = f"{lt.tm_mday:2d}"
        timestamp = time.strftime(f"%b {day} %H:%M:%S", lt)
        return (
            f"<{priority}>{timestamp} {self.hostname} "
            f"{record.name}[{record.process}]: {record.getMessage()}"
        )


LOG_FILE = "/var/log/app.log"


def main():
    logger = logging.getLogger("storage-service")
    logger.setLevel(logging.DEBUG)

    handler = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=1_000_000, backupCount=3
    )
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(RFC3164Formatter())
    logger.addHandler(handler)

    idx = 0
    while True:
        level, message = MESSAGES[idx % len(MESSAGES)]
        logger.log(level, message)
        idx += 1
        time.sleep(3)


if __name__ == "__main__":
    main()
