"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { JOIN_CODE_LENGTH, normalizeJoinCode } from "@/lib/constants";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const normalized = normalizeJoinCode(code);
  const canSubmit = normalized.length === JOIN_CODE_LENGTH;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    router.push(`/join/${normalized}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <h1 className="font-display text-4xl font-bold text-unmute-navy">
          Join a session
        </h1>
        <p className="font-body text-lg text-slate">
          Enter the six-character code from your facilitator.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="block text-left">
            <span className="sr-only">Session code</span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              // Allow paste with spaces/hyphens; normalizeJoinCode trims to 6.
              maxLength={12}
              value={code}
              onChange={(e) => setCode(normalizeJoinCode(e.target.value))}
              className="w-full rounded-md border border-cloud-grey bg-warm-white px-4 py-5 text-center font-mono text-3xl uppercase tracking-[0.4em] text-charcoal shadow-sm outline-none transition focus:border-unmute-navy focus:ring-2 focus:ring-unmute-navy/20"
              placeholder="••••••"
              aria-invalid={!canSubmit && code.length > 0}
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md bg-unmute-navy px-6 py-4 font-display text-lg font-semibold text-white shadow-sm transition hover:bg-deep-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </div>
    </main>
  );
}
