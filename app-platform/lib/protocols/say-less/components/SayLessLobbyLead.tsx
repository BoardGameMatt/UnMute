"use client";

import { useEffect, useState } from "react";
import {
  SAY_LESS_CATEGORY_IDS,
  SAY_LESS_CATEGORY_LABELS,
  SAY_LESS_DEFAULT_CATEGORIES,
  type SayLessCategoryId,
} from "../engine";

type SayLessLobbyLeadProps = {
  sessionId: string;
};

export function SayLessLobbyLead({ sessionId }: SayLessLobbyLeadProps) {
  const [selected, setSelected] = useState<SayLessCategoryId[]>([
    ...SAY_LESS_DEFAULT_CATEGORIES,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/say-less/session/${sessionId}/play`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        state?: { categories?: { id: SayLessCategoryId }[] };
      };
      const ids = body.state?.categories?.map((item) => item.id) ?? [];
      if (ids.length === 2 && ids[0] && ids[1]) setSelected([ids[0], ids[1]]);
    })();
  }, [sessionId]);

  const save = async (next: SayLessCategoryId[]) => {
    if (next.length !== 2 || !next[0] || !next[1]) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/say-less/session/${sessionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "setCategories", categories: [next[0], next[1]] }),
    });
    const body = (await res.json()) as { error?: string };
    setPending(false);
    if (!res.ok) setError(body.error ?? "Could not save the packs.");
  };

  const toggle = (id: SayLessCategoryId) => {
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id].slice(-2);
    setSelected(next);
    if (next.length === 2) void save(next);
  };

  return (
    <section className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm">
      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Facilitator
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold text-unmute-navy">
        Today&apos;s categories
      </h2>
      <p className="mt-2 font-body text-sm text-slate">Choose any two packs.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {SAY_LESS_CATEGORY_IDS.map((id) => {
          const on = selected.includes(id);
          return (
            <li key={id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(id)}
                className={`w-full rounded-md border px-4 py-3 text-left disabled:opacity-40 ${
                  on
                    ? "border-2 border-unmute-navy bg-warm-white"
                    : "border-cloud-grey bg-warm-white"
                }`}
              >
                <p className="font-display text-base font-semibold text-unmute-navy">
                  {SAY_LESS_CATEGORY_LABELS[id]}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      {selected.length !== 2 ? (
        <p className="mt-3 font-body text-sm text-slate">Pick exactly two packs.</p>
      ) : null}
      {error ? (
        <p className="mt-3 font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
