"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signup } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await signup(email, password, name || undefined);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        Start managing your photo magnet orders.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[#111111]">
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            placeholder="Your name (optional)"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#111111]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#111111]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            placeholder="Minimum 8 characters"
          />
        </div>

        {error && (
          <p className="text-sm text-[#DC2626]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B7280]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#2563EB] hover:text-[#1d4ed8]">
          Log in
        </Link>
      </p>
    </>
  );
}
