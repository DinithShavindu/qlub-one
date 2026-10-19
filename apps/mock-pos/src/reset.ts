/** `pnpm --filter mock-pos reset` — clears the running mock-pos (state is in-memory). */
const url = `${process.env.MOCK_POS_URL ?? "http://localhost:4100"}/admin/reset`;
try {
  const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(3000) });
  console.log(res.ok ? "mock-pos reset ✓" : `mock-pos reset failed: ${res.status}`);
} catch {
  console.log("mock-pos is not running — it starts clean on next `pnpm dev`.");
}
export {};
