import type { ErrorCode } from "@one/contracts";
import type { StatusCode } from "hono/utils/http-status";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status: StatusCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", 404, `${what} not found`);
export const unauthorized = (msg = "Please log in") => new AppError("UNAUTHORIZED", 401, msg);

/** Validate with zod; throws a 400 VALIDATION_ERROR listing the bad fields. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw validationError(r.error);
  return r.data;
}

export function validationError(err: ZodError): AppError {
  const fields = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return new AppError("VALIDATION_ERROR", 400, fields.map((f) => `${f.path || "body"}: ${f.message}`).join("; "), { fields });
}
