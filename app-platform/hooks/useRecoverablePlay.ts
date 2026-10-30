"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState, useSessionContext } from "@/components/providers/SessionProvider";

type Options<State, Action> = {
  protocol: string;
  sessionId: string;
  query?: string;
  prepare: (state: State, action: Action) => Action;
  recoverable: (action: Action) => boolean;
  optimistic?: (state: State, action: Action) => State;
};

/** R1/R6/R7: bounded, serialized reads and durable, context-bound inputs.
 * Facilitator commands and timer maintenance reconcile rather than replaying.
 */
export function useRecoverablePlay<State, Action extends { type: string }>({
  protocol, sessionId, query = "", prepare, recoverable, optimistic,
}: Options<State, Action>) {
  const { phase, stateJson } = useGameState();
  const { currentParticipant } = useSessionContext();
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = useRef<State | null>(null);
  const queued = useRef<Action | null>(null);
  const busy = useRef(false);
  const read = useRef<AbortController | null>(null);
  const write = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const lifecycle = useRef(0);
  const stopped = useRef(false);
  const durable = useRef(true);
  const key = `unmute:pending:${protocol}:${sessionId}:${currentParticipant.id}:${query}`;
  const base = `/api/${protocol}/session/${sessionId}`;
  const accept = useCallback((next: State) => { current.current = next; setState(next); }, []);

  const loadQueue = useCallback((): Action | null => {
    try {
      const entries: { action: Action; createdAt: number }[] = [];
      for (const entryKey of Object.keys(window.localStorage)) {
        if (!entryKey.startsWith(`${key}:`)) continue;
        try {
          const entry = JSON.parse(window.localStorage.getItem(entryKey) ?? "null") as { action?: Action; createdAt?: number } | null;
          if (entry?.action && recoverable(entry.action)) entries.push({ action: entry.action, createdAt: entry.createdAt ?? 0 });
        } catch { /* A corrupt entry cannot block independent saved inputs. */ }
      }
      return entries.sort((a, b) => a.createdAt - b.createdAt)[0]?.action ?? null;
    } catch { return null; }
  }, [key, recoverable]);

  const saveQueue = useCallback((action: Action | null) => {
    const previous = queued.current;
    queued.current = action;
    try {
      // One key per input: an acknowledgement in another tab must never erase
      // an independent pending tap. Identical retries still share one key.
      if (action) window.localStorage.setItem(`${key}:${encodeURIComponent(JSON.stringify(action))}`,
        JSON.stringify({ action, createdAt: Date.now() }));
      else if (previous) window.localStorage.removeItem(`${key}:${encodeURIComponent(JSON.stringify(previous))}`);
      durable.current = true;
    } catch {
      durable.current = false;
      if (action) setActionError("Keep this tab open: your browser could not save this input for refresh recovery.");
    }
    if (!action) queued.current = loadQueue();
  }, [key, loadQueue]);

  const reload = useCallback(async (force = false) => {
    if (busy.current || stopped.current || (read.current && !force)) return;
    read.current?.abort();
    const controller = new AbortController();
    read.current = controller;
    const request = ++sequence.current;
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${base}/play${query}`, { cache: "no-store", signal: controller.signal });
      const body = await res.json() as { state?: State; error?: string };
      if (request !== sequence.current || busy.current) return;
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) stopped.current = true;
        setLoadError(body.error ?? "Could not load the workshop. Reconnecting…");
        return;
      }
      if (!body.state) throw new Error("Missing workshop state");
      accept(body.state);
      setLoadError(null);
    } catch {
      if (request === sequence.current) setLoadError("Connection interrupted. Reconnecting…");
    } finally {
      window.clearTimeout(timeout);
      if (read.current === controller) read.current = null;
    }
  }, [accept, base, query]);

  const transmit = useCallback(async (action: Action): Promise<boolean> => {
    if (busy.current || stopped.current) return false;
    busy.current = true;
    const epoch = lifecycle.current;
    ++sequence.current;
    read.current?.abort();
    read.current = null;
    const controller = new AbortController();
    write.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    setPending(true);
    try {
      const res = await fetch(`${base}/action${query}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action), signal: controller.signal,
      });
      const body = await res.json() as { state?: State; error?: string };
      if (epoch !== lifecycle.current) return false;
      if (!res.ok) {
        if (res.status >= 500 || res.status === 408 || res.status === 429) throw new Error("Retryable response");
        saveQueue(null);
        setActionError(body.error ?? "This input could not be accepted. Please try again.");
        return false;
      }
      const terminal = ["complete", "advanceRecap", "completeSession", "skipToReflection"].includes(action.type);
      if (!body.state && !terminal) throw new Error("Unconfirmed action");
      if (body.state) accept(body.state);
      saveQueue(null);
      setLoadError(null);
      setActionError(null);
      if (terminal) stopped.current = true;
      return true;
    } catch {
      if (epoch === lifecycle.current) setActionError(queued.current
        ? durable.current ? "Your input is saved on this device. Reconnecting and retrying…"
          : "Keep this tab open: input is waiting to send, and browser storage is unavailable."
        : "Connection interrupted. Checking the workshop before you try again…");
      return false;
    } finally {
      window.clearTimeout(timeout);
      if (epoch === lifecycle.current) {
        write.current = null;
        busy.current = false;
        setPending(queued.current !== null);
        if (!queued.current) void reload();
      }
    }
  }, [accept, base, query, reload, saveQueue]);

  const send = useCallback(async (action: Action) => {
    if (busy.current || queued.current || !current.current) return false;
    const prepared = prepare(current.current, action);
    if (optimistic) setState(optimistic(current.current, action));
    setActionError(null);
    if (recoverable(prepared)) saveQueue(prepared);
    return transmit(prepared);
  }, [prepare, recoverable, saveQueue, transmit, optimistic]);

  useEffect(() => {
    ++lifecycle.current;
    stopped.current = false;
    current.current = null;
    setState(null);
    queued.current = loadQueue();
    setPending(queued.current !== null);
    const reconcile = () => {
      if (queued.current) void transmit(queued.current);
      else void reload();
    };
    const resume = () => {
      if (document.visibilityState === "hidden") return;
      if (queued.current) reconcile();
      else void reload(true);
    };
    reconcile();
    const interval = window.setInterval(reconcile, 1500);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      ++lifecycle.current;
      ++sequence.current;
      read.current?.abort(); read.current = null;
      write.current?.abort(); write.current = null;
      busy.current = false;
      window.clearInterval(interval);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [key, loadQueue, reload, transmit]);

  useEffect(() => { void reload(); }, [phase, stateJson, reload]);
  return { state, pending, error: actionError ?? loadError, send, reload };
}
