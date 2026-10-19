import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { serve } from "@hono/node-server";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (existsSync(resolve(root, ".env"))) config({ path: resolve(root, ".env") });

const { app } = await import("./app");
const { loadSeed, state } = await import("./store");

loadSeed();
app.post("/admin/reset", (c) => {
  loadSeed();
  console.log("[mock-pos] reset: checks cleared, chaos off, menus reloaded");
  return c.json({ ok: true });
});

const port = Number(process.env.MOCK_POS_PORT ?? 4100);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`[mock-pos] listening on :${port} · restaurants: ${[...state.restaurants.keys()].join(", ")}`);
  console.log(`[mock-pos] POS screen → http://localhost:${port}/ui`);
});
