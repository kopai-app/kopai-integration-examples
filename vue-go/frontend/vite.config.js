import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Browser OTLP exporters POST to /v1/{traces,logs,metrics} on the dev server,
// which proxies to the local Kopai collector on the host. Same-origin from the
// browser's perspective — bypasses Kopai's missing CORS headers.
const kopaiOtlp =
  process.env.KOPAI_OTLP_TARGET || "http://host.docker.internal:4318";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/v1/traces": { target: kopaiOtlp, changeOrigin: true },
      "/v1/logs": { target: kopaiOtlp, changeOrigin: true },
      "/v1/metrics": { target: kopaiOtlp, changeOrigin: true },
    },
  },
});
