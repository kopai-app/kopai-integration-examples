FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends rsyslog python3 supervisor && \
    rm -rf /var/lib/apt/lists/*

COPY app.py /app/app.py
COPY rsyslog.conf /etc/rsyslog.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
