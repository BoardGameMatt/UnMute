"use client";

import { useEffect, useRef } from "react";
import { useDibeImage } from "../hooks/useDibeImage";
import type { DibeState } from "../types";

// Client-side only, effective duration is the minimum across all clients, so a stale bundle can truncate it.
const IMAGE_REVEAL_MS = 8000;

type ImageRevealViewProps = {
  state: DibeState;
  sessionId: string;
  participantId: string;
  sendAction: (type: string, payload: object) => Promise<void>;
  heading: string;
};

export const ImageRevealView = ({
  state,
  sessionId,
  participantId,
  sendAction,
  heading,
}: ImageRevealViewProps) => {
  const advancedRef = useRef(false);
  const { signedUrl, loading, error } = useDibeImage(sessionId, participantId, true);
  const armedPhase = state.phase;

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      void sendAction("advanceFromImageReveal", { armedPhase });
    }, IMAGE_REVEAL_MS);
    return () => clearTimeout(t);
  }, [sendAction, armedPhase]);

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center px-5 py-10">
      <p className="font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        IMAGE REVEAL
      </p>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
        {heading}
      </h1>
      {loading ? (
        <p className="mt-10 font-body text-slate">Loading…</p>
      ) : error ? (
        <p className="mt-10 font-body text-signal-red" role="alert">
          {error}
        </p>
      ) : signedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signedUrl}
          alt={state.active_image_name ?? "Reference image"}
          className="mt-8 max-h-[50vh] w-full max-w-lg object-contain"
        />
      ) : null}
    </div>
  );
};
