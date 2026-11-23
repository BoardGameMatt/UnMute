"use client";

import { useEffect, useRef } from "react";
import { dibeExpiryDelayMs } from "../engine";
import { isDrawItByEarState } from "../types";
import type { Json } from "@/lib/types/database";

/** Resume elapsed shared timers even when the original timer tab disappeared. */
export const useDibeTimerRecovery = (stateJson: Json | undefined,
  sendAction: (type: string, payload: object) => Promise<unknown>, active: boolean) => {
  const latest = useRef(stateJson); latest.current = stateJson;
  useEffect(() => {
    if (!active) return;
    let busy = false, stopped = false;
    const resume = async () => {
      const state = latest.current;
      if (busy || stopped || !isDrawItByEarState(state)) return;
      const candidates: { type: string; payload: Record<string, unknown> }[] = [];
      if (state.phase === "ROUND_DESCRIBE") {
        for (const team of state.teams) {
          const start = state.team_round_starts?.[team.id];
          const participantId = team.describer_rotation[team.current_describer_index];
          if (start && !start.drawing_completed_at && participantId) candidates.push({ type: "describeTimerExpired",
            payload: { participantId, armedPhase: state.phase, timerStartedAt: start.drawing_started_at } });
        }
      } else {
        const type = state.phase === "TUTORIAL_DESCRIBE" ? "describeTimerExpired" :
          state.phase === "SHOW_DRAWINGS" ? "showDrawingsTimerExpired" : state.phase.includes("SCORING_") ? "scoringTimerExpired" : null;
        if (type) candidates.push({ type, payload: { armedPhase: state.phase, timerStartedAt: state.timer_started_at } });
      }
      busy = true;
      try {
        for (const candidate of candidates) {
          if (stopped) break;
          if (dibeExpiryDelayMs(state, candidate.type, candidate.payload) === 0) await sendAction(candidate.type, candidate.payload);
        }
      } catch { /* The next reconciliation retries; deadlines are checked by the server. */ }
      finally { busy = false; }
    };
    const retry = () => { void resume(); };
    retry(); const interval = window.setInterval(retry, 1500);
    window.addEventListener("online", retry); window.addEventListener("focus", retry);
    return () => { stopped = true; window.clearInterval(interval); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); };
  }, [active, sendAction]);
};
