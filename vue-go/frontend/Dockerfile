FROM node:lts-alpine

WORKDIR /app

ARG VITE_API_BASE
ARG VITE_OTEL_EXPORTER_OTLP_ENDPOINT
ARG VITE_OTEL_EXPORTER_OTLP_HEADERS
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_OTEL_EXPORTER_OTLP_ENDPOINT=${VITE_OTEL_EXPORTER_OTLP_ENDPOINT}
ENV VITE_OTEL_EXPORTER_OTLP_HEADERS=${VITE_OTEL_EXPORTER_OTLP_HEADERS}

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 5173

# Example only — ships the Vite dev server. For production, run `npm run build`
# and serve the resulting dist/ behind nginx (or any static host).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
