# Java Backend Integration

Minimal example: Java HTTP server with OpenTelemetry auto-instrumentation via Java agent.

**Documentation:** [Java Integration Guide](https://docs.kopai.app/integration/java)

## Prerequisites

- Java 21+
- Kopai account ([sign up](https://kopai.app))

## Setup

1. Get your backend token from [kopai.app/settings](https://kopai.app/settings)

2. Download the OpenTelemetry Java agent:
   ```bash
   curl -L -O https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
   ```

3. Set environment variables:
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp.kopai.app"
   export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_TOKEN"
   export OTEL_SERVICE_NAME="my-java-service"
   export OTEL_LOGS_EXPORTER="otlp"
   ```

4. Compile and run:
   ```bash
   javac Server.java
   java -javaagent:opentelemetry-javaagent.jar Server
   ```

## Files

- `Server.java` - Example HTTP server using Java's built-in HttpServer

## Learn More

- [Java Integration](https://docs.kopai.app/integration/java) - Full instrumentation guide
- [Sending Traces](https://docs.kopai.app/sending-traces) - OTLP endpoints and configuration
- [Authentication](https://docs.kopai.app/authentication) - Token management
