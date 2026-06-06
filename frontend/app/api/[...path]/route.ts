// Runtime-Proxy: Browser ruft /api/*, dieser Handler leitet serverseitig an das
// Backend weiter. Bewusst KEIN next.config-`rewrites`: dessen Ziel wird zur
// Build-Zeit ins Manifest eingebacken (BACKEND_URL ist dann noch nicht gesetzt)
// und ließe sich im Docker-Standalone-Image zur Laufzeit nicht mehr ändern.
// Hier wird BACKEND_URL bei JEDEM Request gelesen — funktioniert lokal und in
// Compose (http://backend:8000), und der Body wird gestreamt (SSE-Chat live).

import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

// Hop-by-hop-Header, die nicht durchgereicht werden dürfen.
const STRIP_REQUEST = new Set(["host", "connection", "content-length"]);
const STRIP_RESPONSE = new Set([
  "content-encoding",
  "transfer-encoding",
  "connection",
  "content-length",
]);

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const target = `${BACKEND_URL}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  // `duplex: "half"` ist nötig, um einen Request-Stream als Body zu senden.
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
    ...(hasBody ? { body: request.body, duplex: "half" } : {}),
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return Response.json({ detail: "Backend nicht erreichbar." }, { status: 502 });
  }

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE.has(key.toLowerCase())) respHeaders.set(key, value);
  });

  // Body als Stream zurückgeben → der Chat-SSE-Stream kommt live an.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

type Ctx = { params: { path: string[] } };

export function GET(request: NextRequest, { params }: Ctx): Promise<Response> {
  return proxy(request, params.path);
}
export function POST(request: NextRequest, { params }: Ctx): Promise<Response> {
  return proxy(request, params.path);
}
export function DELETE(request: NextRequest, { params }: Ctx): Promise<Response> {
  return proxy(request, params.path);
}
export function PUT(request: NextRequest, { params }: Ctx): Promise<Response> {
  return proxy(request, params.path);
}
export function PATCH(request: NextRequest, { params }: Ctx): Promise<Response> {
  return proxy(request, params.path);
}
