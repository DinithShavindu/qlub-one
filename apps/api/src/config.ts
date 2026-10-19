import { env, loadEnv } from "@one/db";

loadEnv();

export const config = {
  port: Number(env("API_PORT", "4000")),
  mockPosUrl: env("MOCK_POS_URL", "http://localhost:4100").replace(/\/$/, ""),
  adminPassword: env("ADMIN_PASSWORD", "demo"),
  sessionSecret: env("SESSION_SECRET", "dev-only-insecure-secret-change-me"),
  publicCustomerUrl: env("PUBLIC_CUSTOMER_URL", "http://localhost:3000").replace(/\/$/, ""),
  baselineMinPerVendor: Number(env("ONBOARDING_BASELINE_MIN", "30")) || 30,
  posTimeoutMs: Number(env("POS_TIMEOUT_MS", "5000")),
  isDev: env("NODE_ENV", "development") !== "production",
};
