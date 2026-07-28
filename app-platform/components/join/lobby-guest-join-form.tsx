"use client";

import { useState } from "react";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/constants";

type LobbyGuestJoinFormProps = {
  sessionId: string;
  teamId: string;
  joinCode: string;
};

function SubmitButton({
  hasName,
  pending,
}: {
  hasName: boolean;
  pending: boolean;
}) {
  const base =
    "w-full rounded-md px-6 py-4 font-display text-lg font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-unmute-navy disabled:cursor-not-allowed";

  if (pending) {
    return (
      <button
        type="submit"
        disabled
        className={`${base} bg-signal-amber text-deep-navy`}
      >
        Joining…
      </button>
    );
  }

  if (!hasName) {
    return (
      <button
        type="submit"
        disabled
        className={`${base} bg-cloud-grey text-slate opacity-80`}
      >
        Join session
      </button>
    );
  }

  return (
    <button
      type="submit"
      className={`${base} bg-unmute-navy text-white hover:bg-deep-navy`}
    >
      Join session
    </button>
  );
}

export function LobbyGuestJoinForm({
  sessionId,
  teamId,
  joinCode,
}: LobbyGuestJoinFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hasName = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    setPending(true);
    try {
      // Default redirect: "follow". Do NOT use redirect: "manual" — for redirects the
      // fetch spec can yield an opaque response (status 0) with no Location header,
      // which breaks client-side handling and shows a false error.
      const res = await fetch(`/api/join/${encodeURIComponent(joinCode)}`, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      if (res.ok) {
        try {
          const landed = new URL(res.url, window.location.origin);
          if (/\/session\/[^/]+\/lobby\/?$/.test(landed.pathname)) {
            window.location.href = res.url;
            return;
          }
        } catch {
          // ignore
        }
        setError("Could not join. Try again.");
        return;
      }

      let message = "Could not join. Try again.";
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
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="teamId" value={teamId} />

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

      {error ? (
        <p className="text-center text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}

      <SubmitButton hasName={hasName} pending={pending} />
    </form>
  );
}
