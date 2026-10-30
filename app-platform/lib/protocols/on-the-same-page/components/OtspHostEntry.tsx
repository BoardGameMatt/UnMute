"use client";

import { useEffect, useRef, useState } from "react";
import { SHARED_SCREEN_NAME } from "@/lib/protocols/rank-and-file/engine";
import { writeDisplayPin } from "../use-otsp-play";

type Props = {
  hostToken: string;
  sessionId: string;
  joinCode: string;
};

export function OtspHostEntry({ hostToken, sessionId, joinCode }: Props) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    writeDisplayPin(sessionId, true);
  }, [sessionId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const claim = async () => {
      const body = new FormData();
      body.set("displayName", SHARED_SCREEN_NAME);
      const res = await fetch(`/api/host/${encodeURIComponent(hostToken)}`, {
        method: "POST",
        body,
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
          /* fall through */
        }
      }
      let message = "Could not open the shared screen.";
      try {
        const json = (await res.json()) as { error?: string };
        if (json.error) message = json.error;
      } catch {
        /* ignore */
      }
      setError(message);
    };
    void claim();
  }, [hostToken]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 py-12">
      <div className="w-full max-w-lg space-y-6 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">Shared screen</p>
        <h1 className="font-display text-3xl font-bold text-unmute-navy">On the Same Page</h1>
        <p className="font-body text-lg text-charcoal">This laptop is the shared screen. Do not enter a name here.</p>
        <p className="font-body text-lg text-charcoal">Join on your phone now.</p>
        <p className="font-mono text-3xl tracking-[0.3em] text-unmute-navy">{joinCode}</p>
        <p className="font-body text-sm text-slate">{error ?? "Opening the lobby…"}</p>
      </div>
    </main>
  );
}
