// Plain fetch wrapper — no OTel code here on purpose. The browser
// FetchInstrumentation (registered in instrumentation.js) auto-creates a span
// for every fetch and injects the `traceparent` header, so this layer stays
// focused on request shape and error handling.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = { message: await res.text() };
      } catch {
        body = null;
      }
    }
    const message =
      (body && (body.error || body.message)) ||
      `Request failed: ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
};

export function getApiBase() {
  return API_BASE;
}
