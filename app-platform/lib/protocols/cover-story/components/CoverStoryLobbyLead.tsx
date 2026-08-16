"use client";

import { useEffect, useState } from "react";

type CoverStoryLobbyLeadProps = {
  sessionId: string;
};

export function CoverStoryLobbyLead({ sessionId }: CoverStoryLobbyLeadProps) {
  const [revealOn, setRevealOn] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/cover-story/session/${sessionId}/play`);
      if (!res.ok) return;
      const body = (await res.json()) as { state?: { revealOn?: string | null } };
      if (body.state?.revealOn) {
        setRevealOn(body.state.revealOn);
        setSaved(body.state.revealOn);
      }
    })();
  }, [sessionId]);

  const save = async () => {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/cover-story/session/${sessionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "setRevealDate", revealOn }),
    });
    const body = (await res.json()) as { error?: string; state?: { revealOn?: string | null } };
    setPending(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save the date.");
      return;
    }
    setSaved(body.state?.revealOn ?? revealOn);
  };

  return (
    <section className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm">
      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Facilitator
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold text-unmute-navy">
        Reveal date
      </h2>
      <p className="mt-2 font-body text-sm text-slate">
        Sitting B happens on this date. Required before you press Start.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 font-body text-sm text-charcoal">
          Date
          <input
            type="date"
            value={revealOn}
            onChange={(event) => setRevealOn(event.target.value)}
            className="mt-1 w-full rounded-md border border-cloud-grey bg-warm-white px-3 py-2 font-body text-charcoal"
          />
        </label>
        <button
          type="button"
          disabled={!revealOn || pending}
          onClick={() => void save()}
          className="rounded-md bg-unmute-navy px-4 py-2 font-display text-sm font-semibold text-white hover:bg-deep-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save date"}
        </button>
      </div>
      {saved ? (
        <p className="mt-3 font-body text-sm text-unmute-navy">Saved: {saved}</p>
      ) : null}
      {error ? (
        <p className="mt-3 font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
