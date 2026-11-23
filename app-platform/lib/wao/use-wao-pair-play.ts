"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGameState } from "@/components/providers/SessionProvider";
import { deriveItemState, WAO_SETTLE_SECONDS, type WaoItemVisualState, type WaoPairPlayState, type WaoRevealState, type WaoTapAction } from "./types";
import { perspectiveSelections } from "./reduce-taps";
import { classifyPlayLoadStatus, initialPreRoundPollState, reducePreRoundPoll } from "./pre-round-poll";
import type { WaoFacilitatorStatus } from "@/lib/protocols/wrong-answers-only/components/WaoLeadAdvanceControls";

type PendingTap = { pairId: string; itemId: string; action: WaoTapAction; clientSeq: number; operationId: string; createdAt: number };
export type WaoPlayPhase = "loading" | "waiting" | "playing" | "settling" | "locked" | "error";
class HttpFailure extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function useWaoPairPlay(sessionId: string, participantId: string, options: { isLead?: boolean } = {}) {
  const isLead = options.isLead === true;
  const { sessionStatus } = useGameState();
  const terminal = sessionStatus === "completed" || sessionStatus === "cancelled";
  const [state, setState] = useState<WaoPairPlayState | null>(null);
  const [phase, setPhase] = useState<WaoPlayPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTap[]>([]);
  const [selectionA, setSelectionA] = useState<string[]>([]), [selectionB, setSelectionB] = useState<string[]>([]);
  const [starting, setStarting] = useState(false), [startingNext, setStartingNext] = useState(false), [endingSession, setEndingSession] = useState(false);
  const [startError, setStartError] = useState<string | null>(null), [advanceError, setAdvanceError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<WaoRevealState | null>(null), [revealError, setRevealError] = useState<string | null>(null), [revealLoading, setRevealLoading] = useState(false);
  const [facilitatorStatus, setFacilitatorStatus] = useState<WaoFacilitatorStatus | null>(null), [facilitatorStatusError, setFacilitatorStatusError] = useState<string | null>(null);
  const [preRoundPoll, setPreRoundPoll] = useState(initialPreRoundPollState);
  const current = useRef<WaoPairPlayState | null>(null), queue = useRef<PendingTap[]>([]);
  const reading = useRef(false), flushing = useRef(false), closing = useRef(false), revealing = useRef(false);
  const controllers = useRef(new Set<AbortController>()), epoch = useRef(0), sequence = useRef(0), clientSeq = useRef(0), stopped = useRef(false);
  const revealRef = useRef<WaoRevealState | null>(null);
  const prefix = `unmute:wao:pending:${sessionId}:${participantId}:`;
  const storageKey = useCallback((tap: PendingTap) => `${prefix}${tap.pairId}:${tap.operationId}`, [prefix]);
  const publish = useCallback((next: PendingTap[]) => { queue.current = next; setPending(next); }, []);
  const restore = useCallback((pairId: string): PendingTap[] => {
    const entries = new Map(queue.current.filter(tap => tap.pairId === pairId).map(tap => [tap.operationId, tap]));
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(prefix)) continue;
        try {
          const tap = JSON.parse(localStorage.getItem(key) ?? "null") as PendingTap | null;
          if (!tap || typeof tap.operationId !== "string" || typeof tap.itemId !== "string") continue;
          if (tap.pairId !== pairId) { localStorage.removeItem(key); setSyncWarning("An earlier round's unsent tap expired."); continue; }
          entries.set(tap.operationId, tap);
        } catch { /* A corrupt entry cannot block other taps. */ }
      }
    } catch { /* Keep in-memory input usable if browser storage is blocked. */ }
    return Array.from(entries.values()).sort((a, b) => a.createdAt - b.createdAt || a.clientSeq - b.clientSeq);
  }, [prefix]);
  const remove = useCallback((tap: PendingTap) => {
    try { localStorage.removeItem(storageKey(tap)); } catch { /* Keep other saved taps. */ }
    publish(queue.current.filter(item => item.operationId !== tap.operationId));
  }, [publish, storageKey]);
  const json = useCallback(async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
    const controller = new AbortController(); controllers.current.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), init.method === "POST" ? 8000 : 3000);
    try {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init, signal: controller.signal });
      const body = await response.json() as T & { error?: string };
      if (!response.ok) throw new HttpFailure(response.status, body.error ?? "Could not confirm the workshop request.");
      return body;
    } finally { window.clearTimeout(timeout); controllers.current.delete(controller); }
  }, []);
  const load = useCallback(async () => {
    if (reading.current || flushing.current || stopped.current) return;
    reading.current = true; const token = ++sequence.current, life = epoch.current;
    try {
      const next = await json<WaoPairPlayState>(`/api/wao/session/${sessionId}/play`);
      if (life !== epoch.current || token !== sequence.current) return;
      if (current.current?.pairId !== next.pairId) { revealRef.current = null; setReveal(null); setRevealError(null); }
      current.current = next; setState(next); clientSeq.current = Math.max(clientSeq.current, next.lastClientSeq ?? 0);
      const mineIsA = next.myParticipantId === next.participantA;
      setSelectionA(mineIsA ? next.selectionMine : next.selectionTheirs); setSelectionB(mineIsA ? next.selectionTheirs : next.selectionMine);
      const remaining = restore(next.pairId);
      publish(remaining); setError(null); if (!remaining.length) setSyncWarning(null);
      setPreRoundPoll(prev => reducePreRoundPoll(prev, { type: "success" }));
      const elapsed = Date.now() >= Date.parse(next.startedAt ?? "") + next.timerSeconds * 1000;
      setPhase(next.lockedAt ? "locked" : next.startedAt ? elapsed ? "settling" : "playing" : "waiting");
    } catch (failure) {
      if (life !== epoch.current || token !== sequence.current) return;
      const kind = failure instanceof HttpFailure ? classifyPlayLoadStatus(failure.status) : "transient";
      if (kind === "terminal") stopped.current = true;
      setPreRoundPoll(prev => reducePreRoundPoll(prev, { type: kind === "not_found" ? "not_found" : kind === "terminal" ? "terminal" : "transient" }));
      setError(failure instanceof Error ? failure.message : "Connection interrupted. Reconnecting…");
      if (!current.current) setPhase(kind === "terminal" ? "error" : "waiting");
      else setSyncWarning("Connection interrupted. Keeping your selections and retrying…");
    } finally { if (life === epoch.current) reading.current = false; }
  }, [json, publish, restore, sessionId]);
  const flush = useCallback(async () => {
    const active = current.current;
    if (!active || flushing.current || stopped.current) return;
    const waiting = restore(active.pairId); publish(waiting);
    if (!waiting.length) return;
    flushing.current = true; ++sequence.current; const life = epoch.current;
    try {
      while (queue.current.length && life === epoch.current) {
        const tap = queue.current[0];
        try {
          const body = await json<{ selectionA: string[]; selectionB: string[]; tap: { client_seq: number } }>(`/api/wao/pair/${tap.pairId}/tap`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tap),
          });
          if (life !== epoch.current) return;
          setSelectionA(body.selectionA); setSelectionB(body.selectionB); clientSeq.current = Math.max(clientSeq.current, body.tap.client_seq);
          remove(tap); setSyncWarning(null); setError(null);
        } catch (failure) {
          if (life !== epoch.current) return;
          if (failure instanceof HttpFailure && failure.status >= 400 && failure.status < 500 && ![408,429].includes(failure.status)) {
            remove(tap); setSyncWarning(failure.message); continue;
          }
          setSyncWarning("Your tap is saved on this device. Reconnecting and retrying…"); break;
        }
      }
    } finally { if (life === epoch.current) flushing.current = false; }
  }, [json, publish, remove, restore]);
  const closeRound = useCallback(async () => {
    const active = current.current;
    if (!active || active.lockedAt || closing.current || stopped.current) return;
    closing.current = true; ++sequence.current; const life = epoch.current;
    try {
      const body = await json<{ lockedAt: string; lockReason: "timer" }>(`/api/wao/pair/${active.pairId}/close-timer`, { method: "POST" });
      if (life !== epoch.current || current.current?.pairId !== active.pairId) return;
      const next = { ...active, lockedAt: body.lockedAt, lockReason: body.lockReason };
      current.current = next; setState(next); setPhase("locked"); setSyncWarning(null);
    } catch (failure) {
      if (!(failure instanceof HttpFailure && failure.status === 409)) setSyncWarning("Checking the round result. Reconnecting…");
    } finally { if (life === epoch.current) closing.current = false; }
  }, [json]);
  const loadReveal = useCallback(async () => {
    const active = current.current;
    if (!active?.lockedAt || revealing.current || revealRef.current?.pairId === active.pairId) return;
    revealing.current = true; setRevealLoading(true); const life = epoch.current;
    try {
      const body = await json<WaoRevealState>(`/api/wao/pair/${active.pairId}/reveal`);
      if (life !== epoch.current || current.current?.pairId !== active.pairId) return;
      revealRef.current = body; setReveal(body); setRevealError(null);
    } catch (failure) { if (life === epoch.current) setRevealError(failure instanceof Error ? failure.message : "Could not load reveal."); }
    finally { if (life === epoch.current) { revealing.current = false; setRevealLoading(false); } }
  }, [json]);
  const refreshFacilitatorStatus = useCallback(async () => {
    if (!isLead) return;
    const life = epoch.current;
    try { const status = await json<WaoFacilitatorStatus>(`/api/wao/session/${sessionId}/facilitator-status`); if (life !== epoch.current) return; setFacilitatorStatus(status); setFacilitatorStatusError(null); }
    catch (failure) { if (life === epoch.current) setFacilitatorStatusError(failure instanceof Error ? failure.message : "Could not load facilitator status."); }
  }, [isLead, json, sessionId]);
  const reconcile = useCallback(async () => {
    await flush(); await load();
    const active = current.current;
    if (active?.startedAt && !active.lockedAt && Date.now() >= Date.parse(active.startedAt) + (active.timerSeconds + WAO_SETTLE_SECONDS) * 1000) await closeRound();
    if (current.current?.lockedAt) { await loadReveal(); if (isLead) await refreshFacilitatorStatus(); }
  }, [closeRound, flush, isLead, load, loadReveal, refreshFacilitatorStatus]);
  const invalidateRequests = useCallback(() => {
    ++epoch.current; ++sequence.current;
    controllers.current.forEach(controller => controller.abort()); controllers.current.clear();
    reading.current = false; flushing.current = false; closing.current = false; revealing.current = false;
  }, []);
  useEffect(() => {
    ++epoch.current; stopped.current = false; current.current = null; queue.current = []; clientSeq.current = 0;
    setState(null); setPending([]); setPhase("loading"); revealRef.current = null;
    void reconcile();
    const timer = window.setInterval(() => { void reconcile(); }, 1500);
    const resume = () => { if (document.visibilityState !== "hidden") void reconcile(); };
    window.addEventListener("online", resume); window.addEventListener("focus", resume); window.addEventListener("pageshow", resume); window.addEventListener("storage", resume); document.addEventListener("visibilitychange", resume);
    return () => {
      invalidateRequests();
      window.clearInterval(timer); window.removeEventListener("online", resume); window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("storage", resume); document.removeEventListener("visibilitychange", resume);
    };
  }, [reconcile, invalidateRequests]);
  useEffect(() => { if (terminal) stopped.current = true; }, [terminal]);
  useEffect(() => {
    if (!state?.channel || !state.pairId) return;
    const client = createClient();
    const channel = client.channel(state.channel, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "tap" }, () => { void reconcile(); })
      .on("broadcast", { event: "round_locked" }, () => { void reconcile(); })
      .subscribe(() => { void reconcile(); });
    return () => { void client.removeChannel(channel); };
  }, [state?.channel, state?.pairId, reconcile]);
  const confirmed = useMemo(() => state ? perspectiveSelections({ selectionA, selectionB }, state.participantA, state.participantB, participantId) : { selectionMine: [], selectionTheirs: [] }, [state, selectionA, selectionB, participantId]);
  const displayMine = useMemo(() => {
    const selected = new Set(confirmed.selectionMine);
    for (const tap of pending) if (tap.action === "select") selected.add(tap.itemId); else selected.delete(tap.itemId);
    return Array.from(selected);
  }, [confirmed.selectionMine, pending]);
  const itemStates = useMemo(() => new Map<string, WaoItemVisualState>((state?.items ?? []).map(item => [item.id, deriveItemState(item.id, displayMine, confirmed.selectionTheirs)])), [state, displayMine, confirmed.selectionTheirs]);
  const sendTap = useCallback(async (itemId: string) => {
    const active = current.current;
    if (!active || phase !== "playing" || active.lockedAt || stopped.current) return;
    const tap: PendingTap = { pairId: active.pairId, itemId, action: displayMine.includes(itemId) ? "deselect" : "select", clientSeq: ++clientSeq.current, operationId: crypto.randomUUID(), createdAt: Date.now() };
    try { localStorage.setItem(storageKey(tap), JSON.stringify(tap)); }
    catch { setSyncWarning("Keep this tab open: browser storage could not save this tap."); }
    publish([...queue.current, tap]); await flush();
  }, [displayMine, flush, phase, publish, storageKey]);
  const control = useCallback(async (operation: "start-round" | "end") => {
    try {
      await json(`/api/wao/session/${sessionId}/${operation}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ includeInactive: process.env.NODE_ENV !== "production" }) });
      await load(); return true;
    } catch (failure) { setAdvanceError(failure instanceof Error ? failure.message : "The action was not confirmed. Checking the workshop…"); await load(); return false; }
  }, [json, load, sessionId]);
  const startRound = useCallback(async () => {
    if (!isLead || starting) return; setStarting(true); setStartError(null); setAdvanceError(null);
    try { if (!await control("start-round")) setStartError("Could not confirm Start. Check the current round and retry."); }
    finally { setStarting(false); }
  }, [control, isLead, starting]);
  const startNextRound = useCallback(async () => { if (!isLead || startingNext) return false; setStartingNext(true); setAdvanceError(null); try { return await control("start-round"); } finally { setStartingNext(false); } }, [control, isLead, startingNext]);
  const endSession = useCallback(async () => { if (!isLead || endingSession) return false; setEndingSession(true); setAdvanceError(null); try { return await control("end"); } finally { setEndingSession(false); } }, [control, endingSession, isLead]);
  return { state, phase, error, syncWarning, itemStates, unconfirmedItemIds: new Set(pending.map(tap => tap.itemId)), displayMine, selectionTheirs: confirmed.selectionTheirs,
    inputDisabled: phase !== "playing" || Boolean(state?.lockedAt), myInitial: (state?.myDisplayName ?? "Y").trim()[0]?.toUpperCase() ?? "?", partnerInitial: (state?.partnerDisplayName ?? "P").trim()[0]?.toUpperCase() ?? "?",
    sendTap, onTimerComplete: () => { setPhase("settling"); void closeRound(); }, reload: load, startRound, starting, startError, isLead, settleSeconds: WAO_SETTLE_SECONDS, stillTrying: preRoundPoll.showStillTrying,
    reveal, revealError, revealLoading, facilitatorStatus, facilitatorStatusError, advanceError, startingNext, endingSession, startNextRound, endSession };
}
