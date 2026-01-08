# React SPA + Express Backend

Minimal example: React+Vite frontend with Express backend, both instrumented with OpenTelemetry.

**Documentation:** [Browser Integration Guide](https://docs.kopai.app/integration/browser)

## Prerequisites

- Node.js 22+
- Kopai account ([sign up](https://kopai.app))

## Setup

1. Get your tokens from [kopai.app/settings](https://kopai.app/settings)
   - **Frontend token** - for browser telemetry
   - **Backend token** - for server telemetry

2. Configure frontend (`frontend/src/instrumentation.jsx`):
   ```javascript
   Authorization: `Bearer <YOUR_FRONTEND_TOKEN>`
   ```

3. Configure backend (`backend/instrumentation.mjs`):
   ```javascript
   Authorization: `Bearer <YOUR_BACKEND_TOKEN>`
   ```

> **Production:** Use environment variables. See [OTEL_INSTRUMENTATION.md](frontend/OTEL_INSTRUMENTATION.md#production-using-environment-variables).

## Run

```bash
# Terminal 1: Frontend
cd frontend && npm install && npm run dev

# Terminal 2: Backend
cd backend && npm install && npm start
```

Visit http://localhost:5173 and interact with the app. Check traces at [kopai.app](https://kopai.app).

## Structure

```
react-spa/
├── frontend/
│   ├── src/instrumentation.jsx   # Browser OTEL setup
│   └── src/App.jsx               # React app
└── backend/
    ├── instrumentation.mjs       # Node.js OTEL setup
    └── server.js                 # Express API
```

## Learn More

- [Browser Integration](https://docs.kopai.app/integration/browser) - Frontend instrumentation guide
- [Node.js Integration](https://docs.kopai.app/integration/node) - Backend instrumentation guide
- [Authentication](https://docs.kopai.app/authentication) - Token types explained
