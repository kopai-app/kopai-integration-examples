import { NextResponse } from "next/server";

// Same-origin proxy for browser OTel traces.
// Browser can't send directly to the collector (localhost:4318) due to CORS,
// so traces go: browser → /api/otel (same origin) → collector.
export async function POST(request: Request) {
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
  const body = await request.arrayBuffer();

  const res = await fetch(`${endpoint}/v1/traces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  return new NextResponse(null, { status: res.status });
}
