import { redirect } from "next/navigation";

import { LoginForm } from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-[var(--accent)]">บ้านรวมทะเล</p>
          <h1 className="mt-2 text-2xl font-semibold">Tracking Sender</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
