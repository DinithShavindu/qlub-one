import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

/** Repo root, resolved from this file so it works no matter which app imports it. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

let loaded = false;
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const envPath = resolve(REPO_ROOT, ".env");
  if (existsSync(envPath)) config({ path: envPath });
}

export function requireEnv(name: string): string {
  loadEnv();
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}. Copy .env.example to .env at the repo root.`);
  return v;
}

export function env(name: string, fallback: string): string {
  loadEnv();
  return process.env[name] || fallback;
}
