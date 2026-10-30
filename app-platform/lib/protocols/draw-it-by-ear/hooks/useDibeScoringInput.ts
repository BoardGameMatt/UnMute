"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { usePersistedDraft } from "@/hooks/usePersistedDraft";

const parseAnswers = (raw: string): Record<string, boolean> => {
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).filter(([, answer]) => typeof answer === "boolean"));
    }
  } catch { /* An invalid draft must not prevent entering the workshop. */ }
  return {};
};

/** Keep the exact submission UUID and timer window through a refresh or lost ACK. */
export const useDibeScoringInput = (sessionId: string, participantId: string, phase: string,
  timer: string | null, existingAnswers: Record<string, boolean> | undefined) => {
  const { session } = useSessionContext();
  const generation = session.lifecycle_version ?? 0;
  const scope = `unmute:dibe:${sessionId}:${generation}:${participantId}:${phase}:${timer}`;
  const [draft, setDraft] = usePersistedDraft(`${scope}:draft`);
  const [pending, setPending] = usePersistedDraft(`${scope}:pending`);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const volatile = useRef(false);
  const answers = useMemo(() => ({ ...parseAnswers(draft), ...existingAnswers }), [draft, existingAnswers]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, [scope]);

  const transmit = useCallback(async (body: string) => {
    if (controller.current) return;
    const request = new AbortController(); controller.current = request;
    const timeout = window.setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch(`/api/session/${sessionId}/action`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body, signal: request.signal });
      if (!alive.current) return;
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
          setPending(""); setError("This scoring window has changed. Your draft is still saved."); return;
        }
        throw new Error("Retry submission");
      }
      setConfirmed(true); setPending(""); setError(null);
    } catch {
      if (alive.current) setError(volatile.current ? "Reconnecting. Keep this tab open to preserve your answers." : "Answers saved on this device. Reconnecting…");
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === request) controller.current = null;
    }
  }, [sessionId, setPending]);

  useEffect(() => {
    if (!pending) return;
    // Only persisted requests created by this form are replayed.
    try {
      const body = JSON.parse(pending) as { operationId?: unknown; generation?: unknown };
      if (typeof body.operationId !== "string" || body.generation !== generation) { setPending(""); return; }
    } catch { setPending(""); return; }
    const retry = () => { void transmit(pending); };
    retry(); const interval = window.setInterval(retry, 1500);
    window.addEventListener("online", retry);
    return () => { window.clearInterval(interval); window.removeEventListener("online", retry); };
  }, [pending, generation, setPending, transmit]);

  const submit = useCallback(async () => {
    if (confirmed || pending) return;
    const body = JSON.stringify({ actionType: "submitScoring", operationId: crypto.randomUUID(), generation,
      payload: { participantId, answers, armedPhase: phase, timerStartedAt: timer } });
    try { window.localStorage.setItem(`${scope}:pending`, body); } catch { volatile.current = true; }
    setPending(body); await transmit(body);
  }, [confirmed, pending, generation, participantId, answers, phase, timer, scope, setPending, transmit]);

  const setAnswer = (text: string, value: boolean) => { if (!pending && !confirmed) setDraft(JSON.stringify({ ...answers, [text]: value })); };
  return { answers, setAnswer, submit, submitted: confirmed || Boolean(pending) || Boolean(existingAnswers && Object.keys(existingAnswers).length), pending: Boolean(pending), error };
};
