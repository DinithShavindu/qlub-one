import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { ApiError } from "@one/contracts";
import { AppError, validationError } from "./lib/errors";
import { logger } from "./lib/logger";
import { admin } from "./routes/admin";
import { customer } from "./routes/customer";
import { vendor } from "./routes/vendor";
import { webhooks } from "./routes/webhooks";

export const app = new Hono();

// Frontends proxy /v1 same-origin; CORS only matters when someone calls :4000 directly.
app.use(
  "*",
  cors({
    origin: (origin) => (origin && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin) ? origin : null),
    credentials: true,
  }),
);

// one line per request; never the body (checkout carries the guest's name)
app.use("*", async (c, next) => {
  const t0 = Date.now();
  await next();
  if (c.req.path.endsWith("/stream")) return;
  logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - t0 }, "req");
});

app.get("/health", (c) => c.json({ ok: true }));
app.get("/v1/health", (c) => c.json({ ok: true }));

app.route("/v1", customer);
app.route("/v1", vendor);
app.route("/v1", admin);
app.route("/v1", webhooks);

app.notFound((c) => c.json<ApiError>({ error: { code: "NOT_FOUND", message: `No route ${c.req.method} ${c.req.path}` } }, 404));

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json<ApiError>({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  if (err instanceof ZodError) {
    const e = validationError(err);
    return c.json<ApiError>({ error: { code: e.code, message: e.message, details: e.details } }, 400);
  }
  if (err instanceof HTTPException) {
    return c.json<ApiError>({ error: { code: "VALIDATION_ERROR", message: err.message } }, err.status);
  }
  logger.error({ err: err.message, stack: err.stack, path: c.req.path }, "unhandled error");
  return c.json<ApiError>({ error: { code: "INTERNAL", message: "Something went wrong on our side." } }, 500);
});
