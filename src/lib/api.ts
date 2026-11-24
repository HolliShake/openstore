/**
 * OpenStore — Next.js Route Handler helpers.
 * Centralises JSON responses and admin auth guard. (DRY)
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, requireStaff } from "@/lib/auth";

export type Json = Record<string, unknown> | unknown[] | null;

export function ok(data: Json, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created(data: Json) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: Json) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message: string = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function unauthorized(message: string = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message: string = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverError(message: string = "Server error", err?: unknown) {
  console.error("[api]", message, err);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Reads a JSON body safely. Returns {data, error}. */
export async function readJson<T = unknown>(req: NextRequest): Promise<{ data?: T; error?: string }> {
  try {
    const text = await req.text();
    if (!text) return { data: {} as T };
    return { data: JSON.parse(text) as T };
  } catch (e) {
    return { error: "Invalid JSON body" };
  }
}

/** Wraps a handler with admin auth (role="admin"). Returns 401 if not
 *  signed in, 403 if signed in as a non-admin (e.g. cashier). */
export function withAdmin<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<Response> | Response,
) {
  return async (req: NextRequest, ...args: T): Promise<Response> => {
    const isAuthed = await requireStaff();
    if (!isAuthed) return unauthorized("You must be signed in.");
    const isAdmin = await requireAdmin();
    if (!isAdmin) return forbidden("Admin access required.");
    return handler(req, ...args);
  };
}

/** Wraps a handler with staff auth (admin OR cashier — e.g. POS checkout). */
export function withStaff<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<Response> | Response,
) {
  return async (req: NextRequest, ...args: T): Promise<Response> => {
    const isAuthed = await requireStaff();
    if (!isAuthed) return unauthorized("You must be signed in.");
    return handler(req, ...args);
  };
}
