"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiClientError, Button, apiFetch } from "@one/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Enter the admin password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/v1/admin/login", { method: "POST", json: { password } });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/venues");
    } catch (err) {
      setError(err instanceof ApiClientError && err.status === 401 ? "Wrong password. Try again." : err instanceof Error ? err.message : "Couldn't sign in.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-card" noValidate>
      <p className="font-display text-h1 font-bold">qlub Ops</p>
      <p className="mb-6 mt-1 text-small text-ink-muted">Onboard and run food courts as one venue.</p>
      <label htmlFor="password" className="mb-1 block text-small font-semibold">
        Admin password
      </label>
      <input
        id="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? "password-error" : undefined}
        className="h-11 w-full rounded-md border border-line bg-surface px-3 text-body"
      />
      {error && (
        <p id="password-error" role="alert" className="mt-2 text-small text-status-failed-fg">
          {error}
        </p>
      )}
      <Button type="submit" block className="mt-6" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
