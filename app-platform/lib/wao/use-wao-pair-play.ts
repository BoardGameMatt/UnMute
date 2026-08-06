"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deriveItemState,
  WAO_SETTLE_SECONDS,
  type WaoBroadcastPayload,
  type WaoItemVisualState,
  type WaoPairPlayState,
  type WaoTapAction,
} from "@/lib/wao/types";
import { perspectiveSelections } from "@/lib/wao/reduce-taps";

type PendingTap = {
  itemId: string;
  action: WaoTapAction;
  clientSeq: number;
  attempts: number;
};

export type WaoPlayPhase = "loading" | "waiting" | "playing" | "settling" | "locked" | "error";

const MAX_RETRIES = 2;

function initialFromLetter(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

function applyOptimistic(
  confirmedMine: string[],
  pending: PendingTap[]
): string[] {
  const set = new Set(confirmedMine);
  const ordered = [...pending].sort((a, b) => a.clientSeq - b.clientSeq);
  for (const tap of ordered) {
    if (tap.action === "select") set.add(tap.itemId);
    else set.delete(tap.itemId);
  }
  return Array.from(set);
}

export function useWaoPairPlay(sessionId: string, participantId: string) {
  const [state, setState] = useState<WaoPairPlayState | null>(null);
  const [phase, setPhase] = useState<WaoPlayPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTap[]>([]);
  const [selectionA, setSelectionA] = useState<string[]>([]);
  const [selectionB, setSelectionB] = useState<string[]>([]);
  const clientSeqRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/wao/session/${sessionId}/play`, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setPhase(res.status === 404 ? "waiting" : "error");
      setError(body?.error ?? "Could not load play state.");
      setState(null);
      return;
    }
    const next = (await res.json()) as WaoPairPlayState;
    setState(next);
    const abs = perspectiveToAbsolute(next);
    setSelectionA(abs.selectionA);
    setSelectionB(abs.selectionB);
    clientSeqRef.current = 0;
    setPending([]);
    if (next.lockedAt) setPhase("locked");
    else if (next.startedAt) setPhase("playing");
    else setPhase("waiting");
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshState = useCallback(async (pairId: string) => {
    const res = await fetch(`/api/wao/pair/${pairId}/state`, {
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const next = (await res.json()) as WaoPairPlayState;
    setState(next);
    const abs = perspectiveToAbsolute(next);
    setSelectionA(abs.selectionA);
    setSelectionB(abs.selectionB);
    if (next.lockedAt) setPhase("locked");
  }, []);

  // Realtime broadcast channel — pair_id is a capability token.
  useEffect(() => {
    if (!state?.channel || !state.pairId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(state.channel, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "tap" }, ({ payload }) => {
        const body = payload as WaoBroadcastPayload;
        if (body.type !== "tap" || body.pairId !== state.pairId) return;
        setSelectionA(body.selectionA);
        setSelectionB(body.selectionB);
        setPending((prev) =>
          prev.filter(
            (p) =>
              !(
                body.tap.participantId === participantId &&
                p.clientSeq === body.tap.clientSeq
              )
          )
        );
      })
      .on("broadcast", { event: "lock" }, ({ payload }) => {
        const body = payload as WaoBroadcastPayload;
        if (body.type !== "lock" || body.pairId !== state.pairId) return;
        setState((prev) => {
          if (!prev) return prev;
          const iAmA = prev.myParticipantId === prev.participantA;
          return {
            ...prev,
            myLockedAt: iAmA ? body.lockedAAt : body.lockedBAt,
            partnerLockedAt: iAmA ? body.lockedBAt : body.lockedAAt,
            lockedAt: body.lockedAt,
            lockReason: body.lockReason,
          };
        });
        if (body.lockedAt) setPhase("locked");
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state?.channel, state?.pairId, participantId]);

  const confirmedPerspective = useMemo(() => {
    if (!state) {
      return { selectionMine: [] as string[], selectionTheirs: [] as string[] };
    }
    return perspectiveSelections(
      { selectionA, selectionB },
      state.participantA,
      state.participantB,
      participantId
    );
  }, [state, selectionA, selectionB, participantId]);

  const displayMine = useMemo(
    () => applyOptimistic(confirmedPerspective.selectionMine, pending),
    [confirmedPerspective.selectionMine, pending]
  );

  const itemStates = useMemo(() => {
    if (!state) return new Map<string, WaoItemVisualState>();
    const map = new Map<string, WaoItemVisualState>();
    for (const item of state.items) {
      map.set(
        item.id,
        deriveItemState(item.id, displayMine, confirmedPerspective.selectionTheirs)
      );
    }
    return map;
  }, [state, displayMine, confirmedPerspective.selectionTheirs]);

  const unconfirmedItemIds = useMemo(() => {
    return new Set(pending.map((p) => p.itemId));
  }, [pending]);

  const sendTap = useCallback(
    async (itemId: string) => {
      if (!state || phase !== "playing") return;
      if (state.myLockedAt || state.lockedAt) return;

      const currentlyMine = displayMine.includes(itemId);
      const action: WaoTapAction = currentlyMine ? "deselect" : "select";
      const clientSeq = clientSeqRef.current + 1;
      clientSeqRef.current = clientSeq;

      const pendingTap: PendingTap = { itemId, action, clientSeq, attempts: 0 };
      setPending((prev) => [...prev, pendingTap]);
      setSyncWarning(null);

      const attempt = async (tap: PendingTap): Promise<boolean> => {
        try {
          const res = await fetch(`/api/wao/pair/${state.pairId}/tap`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: tap.itemId,
              action: tap.action,
              clientSeq: tap.clientSeq,
            }),
          });
          if (!res.ok) {
            return false;
          }
          const body = (await res.json()) as {
            selectionA: string[];
            selectionB: string[];
          };
          setSelectionA(body.selectionA);
          setSelectionB(body.selectionB);
          setPending((prev) => prev.filter((p) => p.clientSeq !== tap.clientSeq));
          return true;
        } catch {
          return false;
        }
      };

      let ok = await attempt(pendingTap);
      let attempts = 0;
      while (!ok && attempts < MAX_RETRIES) {
        attempts += 1;
        await wait(300 * attempts);
        ok = await attempt({ ...pendingTap, attempts });
      }

      if (!ok) {
        setPending((prev) => prev.filter((p) => p.clientSeq !== clientSeq));
        setSyncWarning("A tap did not sync. Check your connection.");
        void refreshState(state.pairId);
      }
    },
    [state, phase, displayMine, refreshState]
  );

  const lockIn = useCallback(async () => {
    if (!state || state.myLockedAt || state.lockedAt) return;
    const res = await fetch(`/api/wao/pair/${state.pairId}/lock`, {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSyncWarning(body?.error ?? "Could not lock in.");
      return;
    }
    const body = (await res.json()) as {
      lockedAAt: string | null;
      lockedBAt: string | null;
      lockedAt: string | null;
      lockReason: "both_locked" | "timer" | null;
    };
    setState((prev) => {
      if (!prev) return prev;
      const iAmA = prev.myParticipantId === prev.participantA;
      return {
        ...prev,
        myLockedAt: iAmA ? body.lockedAAt : body.lockedBAt,
        partnerLockedAt: iAmA ? body.lockedBAt : body.lockedAAt,
        lockedAt: body.lockedAt,
        lockReason: body.lockReason,
      };
    });
    if (body.lockedAt) setPhase("locked");
  }, [state]);

  const onTimerComplete = useCallback(() => {
    if (!state || closingTimerRef.current) return;
    setPhase("settling");
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      closingTimerRef.current = true;
      void (async () => {
        const res = await fetch(`/api/wao/pair/${state.pairId}/close-timer`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.ok) {
          const body = (await res.json()) as {
            lockedAt: string | null;
            lockReason: "both_locked" | "timer" | null;
          };
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  lockedAt: body.lockedAt,
                  lockReason: body.lockReason,
                }
              : prev
          );
          setPhase("locked");
        } else {
          void refreshState(state.pairId);
        }
      })();
    }, WAO_SETTLE_SECONDS * 1000);
  }, [state, refreshState]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const inputDisabled =
    phase !== "playing" ||
    Boolean(state?.myLockedAt) ||
    Boolean(state?.lockedAt);

  return {
    state,
    phase,
    error,
    syncWarning,
    itemStates,
    unconfirmedItemIds,
    displayMine,
    selectionTheirs: confirmedPerspective.selectionTheirs,
    inputDisabled,
    myInitial: initialFromLetter(state?.myDisplayName ?? "Y"),
    partnerInitial: initialFromLetter(state?.partnerDisplayName ?? "P"),
    sendTap,
    lockIn,
    onTimerComplete,
    reload: load,
    settleSeconds: WAO_SETTLE_SECONDS,
  };
}

function perspectiveToAbsolute(state: WaoPairPlayState): {
  selectionA: string[];
  selectionB: string[];
} {
  if (state.myParticipantId === state.participantA) {
    return {
      selectionA: state.selectionMine,
      selectionB: state.selectionTheirs,
    };
  }
  return {
    selectionA: state.selectionTheirs,
    selectionB: state.selectionMine,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
