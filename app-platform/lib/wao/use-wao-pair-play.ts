"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deriveItemState,
  WAO_SETTLE_SECONDS,
  type WaoBroadcastPayload,
  type WaoItemVisualState,
  type WaoPairPlayState,
  type WaoRevealState,
  type WaoTapAction,
} from "@/lib/wao/types";
import { perspectiveSelections } from "@/lib/wao/reduce-taps";

type PendingTap = {
  itemId: string;
  action: WaoTapAction;
  clientSeq: number;
  attempts: number;
};

export type WaoPlayPhase =
  | "loading"
  | "waiting"
  | "playing"
  | "settling"
  | "locked"
  | "error";

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

export function useWaoPairPlay(
  sessionId: string,
  participantId: string,
  options: { isLead?: boolean } = {}
) {
  const isLead = options.isLead === true;
  const [state, setState] = useState<WaoPairPlayState | null>(null);
  const [phase, setPhase] = useState<WaoPlayPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTap[]>([]);
  const [selectionA, setSelectionA] = useState<string[]>([]);
  const [selectionB, setSelectionB] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<WaoRevealState | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const clientSeqRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerRef = useRef(false);
  const pairIdRef = useRef<string | null>(null);
  const revealFetchedForRef = useRef<string | null>(null);

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
      pairIdRef.current = null;
      return;
    }
    const next = (await res.json()) as WaoPairPlayState;
    setState(next);
    pairIdRef.current = next.pairId;
    const abs = perspectiveToAbsolute(next);
    setSelectionA(abs.selectionA);
    setSelectionB(abs.selectionB);
    clientSeqRef.current = 0;
    setPending([]);
    closingTimerRef.current = false;
    setReveal(null);
    setRevealError(null);
    revealFetchedForRef.current = null;
    if (next.lockedAt) setPhase("locked");
    else if (next.startedAt) setPhase("playing");
    else setPhase("waiting");
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const id = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(id);
  }, [phase, load]);

  const startRound = useCallback(async () => {
    if (!isLead || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const includeInactive = process.env.NODE_ENV !== "production";
      const res = await fetch(`/api/wao/session/${sessionId}/start-round`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeInactive }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setStartError(body?.error ?? "Could not start the round.");
        return;
      }
      await load();
    } finally {
      setStarting(false);
    }
  }, [isLead, starting, sessionId, load]);

  const refreshState = useCallback(async (pairId: string) => {
    const res = await fetch(`/api/wao/pair/${pairId}/state`, {
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const next = (await res.json()) as WaoPairPlayState;
    setState(next);
    pairIdRef.current = next.pairId;
    const abs = perspectiveToAbsolute(next);
    setSelectionA(abs.selectionA);
    setSelectionB(abs.selectionB);
    if (next.lockedAt) setPhase("locked");
  }, []);

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
      .on("broadcast", { event: "round_locked" }, ({ payload }) => {
        const body = payload as WaoBroadcastPayload;
        if (body.type !== "round_locked" || body.pairId !== state.pairId) return;
        setState((prev) =>
          prev
            ? {
                ...prev,
                lockedAt: body.lockedAt,
                lockReason: body.lockReason,
              }
            : prev
        );
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
      if (state.lockedAt) return;

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

  const onTimerComplete = useCallback(() => {
    if (closingTimerRef.current) return;
    const pairId = pairIdRef.current;
    if (!pairId) return;

    setPhase("settling");
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

    const closeAfterSettle = async () => {
      closingTimerRef.current = true;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const res = await fetch(`/api/wao/pair/${pairId}/close-timer`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.ok) {
          const body = (await res.json()) as {
            lockedAt: string | null;
            lockReason: "timer" | null;
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
          return;
        }
        if (res.status !== 409) {
          void refreshState(pairId);
          return;
        }
        // Client clock ahead of server settle gate — wait and retry.
        closingTimerRef.current = false;
        await wait(400 * (attempt + 1));
        closingTimerRef.current = true;
      }
      void refreshState(pairId);
    };

    settleTimerRef.current = setTimeout(() => {
      void closeAfterSettle();
    }, WAO_SETTLE_SECONDS * 1000);
  }, [refreshState]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "locked") return;
    const pairId = pairIdRef.current ?? state?.pairId ?? null;
    if (!pairId) return;
    if (revealFetchedForRef.current === pairId) return;

    let cancelled = false;
    revealFetchedForRef.current = pairId;
    setRevealLoading(true);
    setRevealError(null);

    void (async () => {
      const res = await fetch(`/api/wao/pair/${pairId}/reveal`, {
        credentials: "same-origin",
      });
      if (cancelled) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setRevealError(body?.error ?? "Could not load reveal.");
        setRevealLoading(false);
        revealFetchedForRef.current = null;
        return;
      }
      const body = (await res.json()) as WaoRevealState;
      setReveal(body);
      setRevealLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, state?.pairId]);

  const inputDisabled = phase !== "playing" || Boolean(state?.lockedAt);

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
    onTimerComplete,
    reload: load,
    startRound,
    starting,
    startError,
    isLead,
    settleSeconds: WAO_SETTLE_SECONDS,
    reveal,
    revealError,
    revealLoading,
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
