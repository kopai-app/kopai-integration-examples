# Adding OpenTelemetry instrumentation to a React application

1. Add dependencies

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/context-zone @opentelemetry/instrumentation @opentelemetry/instrumentation-document-load @opentelemetry/exporter-trace-otlp-http
```

If your app is using [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), use `npm install @opentelemetry/instrumentation-fetch`

If your app is using [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), use `npm install @opentelemetry/instrumentation-xml-http-request`


2. Create instrumentation module

add instrumentation.jsx

```jsx
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export const setupInstrumentation = () => {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "otel-survey-spa",
    [ATTR_SERVICE_VERSION]: "1.2.3",
  });

  const otlpExporter = new OTLPTraceExporter({
    url: "https://otlp-http.kopai.app/v1/traces",
    headers: {
      Authorization: `Bearer <YOUR_TOKEN_HERE>`,
    },
  });

  const spanProcessor = new BatchSpanProcessor(otlpExporter);
  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /.+/g, // Propagate to all backend URLs
        ],
      }),
    ],
  });
};
```

3. Initialize in your entry point (main.jsx)

```
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import { setupInstrumentation } from "./instrumentation.jsx";

setupInstrumentation();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

## Production: Using Environment Variables

In production, avoid hardcoding tokens. Vite exposes env vars prefixed with `VITE_` to client code via `import.meta.env`.

1. Create `.env` in `frontend/`:

```
VITE_KOPAI_TOKEN=your_frontend_token
VITE_KOPAI_URL=https://otlp-http.kopai.app/v1/traces
```

2. Update `instrumentation.jsx`:

```jsx
const otlpExporter = new OTLPTraceExporter({
  url: import.meta.env.VITE_KOPAI_URL,
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_KOPAI_TOKEN}`,
  },
});
```

3. Add `.env` to `.gitignore` to avoid committing secrets.

> **Note:** Vite requires the `VITE_` prefix for client-exposed env vars. See [Vite env docs](https://vite.dev/guide/env-and-mode.html).

### Other Bundlers

| Bundler | Prefix | Access | Docs |
|---------|--------|--------|------|
| Vite | `VITE_` | `import.meta.env.VITE_*` | [Vite Env](https://vite.dev/guide/env-and-mode.html) |
| CRA/Webpack | `REACT_APP_` | `process.env.REACT_APP_*` | [CRA Env](https://create-react-app.dev/docs/adding-custom-environment-variables/) |
| Parcel | (none) | `process.env.*` | [Parcel Env](https://parceljs.org/features/node-emulation/#environment-variables) |
| Next.js | `NEXT_PUBLIC_` | `process.env.NEXT_PUBLIC_*` | [Next.js Env](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables) |

---

Further reading:
https://opentelemetry.io/docs/languages/js/getting-started/browser/
https://opentelemetry.io/docs/languages/js/instrumentation/
