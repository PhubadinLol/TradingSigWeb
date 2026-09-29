/** Helpers shared by API route handlers. */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ProviderError } from "./data";
import { ValidationError } from "./validation";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps known error types to HTTP responses; hides internals for unknown errors. */
export function handleError(e: unknown) {
  if (e instanceof ValidationError) return errorResponse(e.message, e.status);
  if (e instanceof ZodError) return errorResponse(e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400);
  if (e instanceof ProviderError) return errorResponse(e.message, e.status);
  console.error("[api] Unhandled error:", e);
  return errorResponse("Internal server error", 500);
}
