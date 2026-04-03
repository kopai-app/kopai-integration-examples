# Build rsyslog from source with the omotel (OpenTelemetry) output module.
# The omotel module is not yet available as a distribution package, so we
# compile it ourselves. This makes the build slow (~5 min) but reproducible.

FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    autoconf \
    automake \
    libtool \
    pkg-config \
    git \
    ca-certificates \
    bison \
    flex \
    libcurl4-openssl-dev \
    libfastjson-dev \
    libprotobuf-c-dev \
    protobuf-c-compiler \
    libestr-dev \
    libgcrypt20-dev \
    libsnappy-dev \
    zlib1g-dev \
    uuid-dev \
    libsystemd-dev \
    && rm -rf /var/lib/apt/lists/*

# The omotel module is on the main branch but not in any tagged release yet.
ARG RSYSLOG_BRANCH=main
RUN git clone --depth 1 --branch ${RSYSLOG_BRANCH} \
    https://github.com/rsyslog/rsyslog.git /src/rsyslog

WORKDIR /src/rsyslog
RUN autoreconf -fi && \
    ./configure \
      --prefix=/usr \
      --sysconfdir=/etc \
      --enable-omotel=yes \
      --disable-generate-man-pages \
      --disable-testbench && \
    make -j$(nproc) && \
    make install DESTDIR=/install

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    supervisor \
    libcurl4 \
    libfastjson4 \
    libprotobuf-c1 \
    libestr0 \
    libsnappy1v5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install/usr /usr

COPY app.py /app/app.py
COPY rsyslog.conf /etc/rsyslog.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
