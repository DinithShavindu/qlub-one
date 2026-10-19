import { serve } from "@hono/node-server";
import { ensureIndexes } from "@one/db";
import { app } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";

try {
  await ensureIndexes();
  logger.info("MongoDB connected, indexes ensured");
} catch (err) {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, "MongoDB unavailable at startup — will retry on first request");
}

serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, () => {
  logger.info(`api listening on :${config.port} (mock-pos ${config.mockPosUrl})`);
});
