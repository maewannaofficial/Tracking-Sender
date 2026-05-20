"use client";

import { Loader2, LogIn } from "lucide-react";
import { useState } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      window.location.href = "/dashboard";
      return;
    }

    const payload = await response.json().catch(() => ({}));
    setError(typeof payload.error === "string" ? payload.error : "เข้าสู่ระบบไม่สำเร็จ");
    setIsSubmitting(false);
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-medium" htmlFor="password">
        รหัสผ่าน
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-100"
        autoComplete="current-password"
        required
      />
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        เข้าสู่ระบบ
      </button>
    </form>
  );
}
