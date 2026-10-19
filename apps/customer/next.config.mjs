import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// read API_URL from the repo-root .env (Next only auto-loads .env from the app folder)
function rootEnv(key, fallback) {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), "../../.env");
  if (!existsSync(p)) return fallback;
  const line = readFileSync(p, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).split(/\s+#/)[0].trim().replace(/^"|"$/g, "") : fallback;
}
const API_URL = rootEnv("API_URL", "http://localhost:4000");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SSE must not be buffered/compressed by the dev proxy
  compress: false,
  transpilePackages: ["@one/ui", "@one/contracts"],
  // same-origin API: browser calls /v1/* → api. Cookies + SSE just work, phones only need :PORT.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${API_URL}/v1/:path*` }];
  },
};
export default nextConfig;
