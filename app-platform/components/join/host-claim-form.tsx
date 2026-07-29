"use client";

import { useState } from "react";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/constants";

type HostClaimFormProps = {
  hostToken: string;
  needsName: boolean;
};

/**
 * Claims lead via the host token. If this browser already has a participant
 * cookie for the session, the server promotes that row and displayName is optional.
 */
export function HostClaimForm({ hostToken, needsName }: HostClaimFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hasName = name.trim().length > 0;
  const canSubmit = !needsName || hasName;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    setPending(true);
    try {
      const res = await fetch(`/api/host/${encodeURIComponent(hostToken)}`, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      if (res.ok) {
        try {
          const landed = new URL(res.url, window.location.origin);
          if (/\/session\/[^/]+(\/lobby)?\/?$/.test(landed.pathname)) {
            window.location.href = res.url;
            return;
          }
        } catch {
          // ignore
        }
        setError("Could not claim host. Try again.");
        return;
      }

      let message = "Could not claim host. Try again.";
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore
      }
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
      {needsName ? (
        <label className="block text-left">
          <span className="mb-2 block font-mono text-xs font-medium uppercase tracking-widest text-steel-blue">
            Display name
          </span>
          <input
            name="displayName"
            type="text"
            autoComplete="name"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-cloud-grey bg-warm-white px-4 py-5 font-body text-lg text-charcoal shadow-sm outline-none transition placeholder:text-slate focus:border-unmute-navy focus:ring-2 focus:ring-unmute-navy/20"
            placeholder="How should we call you?"
          />
        </label>
      ) : null}

      {error ? (
        <p className="text-center text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || pending}
        className="w-full rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Claiming…" : "Enter as facilitator"}
      </button>
    </form>
  );
}
