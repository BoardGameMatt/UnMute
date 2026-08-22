"use client";

import { useState } from "react";
import type { CoverStoryPickPageData } from "@/lib/cover-story/pick-page";

type CoverStoryPickFormProps = {
  token: string;
  initial: CoverStoryPickPageData;
};

export function CoverStoryPickForm({ token, initial }: CoverStoryPickFormProps) {
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lock = async (agencyId: number) => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/cover-story/pick/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        data?: CoverStoryPickPageData;
      };
      if (!response.ok || !body.ok || !body.data) {
        setError(body.error ?? "Could not lock that cover.");
        return;
      }
      setData(body.data);
    } catch {
      setError("Could not lock that cover.");
    } finally {
      setPending(false);
    }
  };

  if (data.locked) {
    return (
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-cloud-grey bg-warm-white p-6">
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
          Cover locked
        </p>
        <h2 className="font-display text-2xl font-bold text-unmute-navy">{data.lockedAgencyName}</h2>
        <p className="font-body text-slate">
          {data.displayName}&apos;s cover is set. Reveal day is {data.revealLabel}. You can close
          this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="space-y-2 text-center">
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
          Cover Story · Private pick
        </p>
        <h1 className="font-display text-3xl font-bold text-unmute-navy">{data.displayName}</h1>
        <p className="font-body text-slate">
          Choose one agency to lock as your cover. Mission runs until {data.revealLabel}.
        </p>
      </div>

      {error ? <p className="text-center font-body text-sm text-signal-red">{error}</p> : null}

      <ul className="space-y-4">
        {(data.cards ?? []).map((card) => (
          <li
            key={card.agencyId}
            className="rounded-lg border border-cloud-grey bg-warm-white p-5 shadow-sm"
          >
            <h2 className="mb-3 font-display text-xl font-semibold text-unmute-navy">{card.name}</h2>
            <ul className="mb-4 space-y-1 font-body text-sm text-charcoal">
              {card.words.map((word) => (
                <li key={word}>{word}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={pending}
              onClick={() => void lock(card.agencyId)}
              className="w-full rounded-md bg-signal-amber px-6 py-3 font-display font-semibold text-deep-navy transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Lock {card.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
