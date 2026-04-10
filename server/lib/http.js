import { ZodError } from "zod";
import { AppError } from "../../lib/errors.js";

export function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

export function fail(res, message, status = 400, extra = {}) {
  return res.status(status).json({ error: message, ...extra });
}

export function handleError(res, error) {
  if (error instanceof ZodError) {
    return fail(res, "Validation failed", 422, {
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    });
  }

  if (error instanceof AppError) {
    return fail(res, error.message, error.status, error.meta || {});
  }

  console.error(error);
  return fail(res, error?.message || "Unexpected error", 500);
}

export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
