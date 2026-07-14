"use client";

import { useEffect, useRef, useState } from "react";

const FALLBACK_URL = "https://survey.evaluoi.app";
const LOAD_TIMEOUT_MS = 10_000;

type EmbedStatus = "loading" | "ready" | "error";

export const EvaluoiSurvey = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<EmbedStatus>("loading");

  useEffect(() => {
    const surveyId = process.env.NEXT_PUBLIC_EVALUOI_SURVEY_ID;
    const embedSrc = process.env.NEXT_PUBLIC_EVALUOI_EMBED_SRC;

    if (!surveyId || !embedSrc) {
      console.error(
        "[evaluoi] Missing NEXT_PUBLIC_EVALUOI_SURVEY_ID or NEXT_PUBLIC_EVALUOI_EMBED_SRC. Origin:",
        window.location.origin
      );
      setStatus("error");
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let script: HTMLScriptElement | null = null;

    const fail = (reason: string) => {
      if (cancelled) return;
      console.error(`[evaluoi] ${reason}. Origin:`, window.location.origin);
      setStatus("error");
    };

    const markReady = () => {
      if (cancelled) return;
      if (container.childNodes.length > 0) {
        setStatus("ready");
        if (timeoutId) clearTimeout(timeoutId);
        observer?.disconnect();
      }
    };

    observer = new MutationObserver(markReady);
    observer.observe(container, { childList: true, subtree: true });

    timeoutId = setTimeout(() => {
      if (cancelled) return;
      if (container.childNodes.length === 0) {
        fail("Embed timed out after 10s with empty container (origin allowlist rejection or silent vendor failure)");
      }
    }, LOAD_TIMEOUT_MS);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${embedSrc}"]`
    );

    if (existing) {
      script = existing;
      // Vendor already present — wait for MutationObserver / timeout.
      if (container.childNodes.length > 0) {
        markReady();
      }
    } else {
      script = document.createElement("script");
      script.src = embedSrc;
      script.async = true;
      script.setAttribute("data-survey-id", surveyId);
      script.onerror = () => {
        fail("Script failed to load (network or script-src rejection)");
      };
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      observer?.disconnect();
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (container) {
        container.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="w-full space-y-4">
      {status === "loading" ? (
        <div
          className="flex min-h-[320px] items-center justify-center rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm"
          aria-busy="true"
          aria-label="Loading survey"
        >
          <div className="space-y-3 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
              Loading survey
            </p>
            <div className="mx-auto h-2 w-40 animate-pulse rounded-full bg-cloud-grey" />
            <div className="mx-auto h-2 w-28 animate-pulse rounded-full bg-cloud-grey" />
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div
          className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm"
          role="alert"
        >
          <p className="font-display text-xl font-semibold text-unmute-navy">
            Survey could not load
          </p>
          <p className="mt-3 font-body text-base text-charcoal">
            If the survey does not load here, open it directly.
          </p>
          <a
            href={FALLBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex rounded-md bg-signal-amber px-5 py-3 font-display text-base font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold"
          >
            Open survey directly
          </a>
        </div>
      ) : null}

      <div
        id="evaluoi-survey"
        ref={containerRef}
        className={status === "error" ? "hidden" : undefined}
        aria-hidden={status === "loading" ? true : undefined}
      />
    </div>
  );
};
