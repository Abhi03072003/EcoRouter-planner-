import { ZodError } from "zod";
import { AppError } from "./errors.js";

export function ok(data, status = 200) {
  return Response.json(data, { status });
}

export function fail(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

export function parseBodyError(error) {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, {
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    });
  }

  if (error instanceof AppError) {
    return fail(error.message, error.status, error.meta || {});
  }

  return fail("Unexpected error", 500);
}
