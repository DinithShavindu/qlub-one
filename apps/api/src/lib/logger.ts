import pino from "pino";
import { config } from "../config";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.VITEST ? "silent" : "info"),
  // never log guest names, PINs, passwords or cookies
  redact: {
    paths: ["guestFirstName", "*.guestFirstName", "pin", "*.pin", "password", "*.password", "req.headers.cookie"],
    censor: "[redacted]",
  },
  ...(config.isDev && !process.env.VITEST
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
    : {}),
});
