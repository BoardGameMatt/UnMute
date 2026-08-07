/**
 * Pre-round play-load classification and backoff for useWaoPairPlay.
 * Pure — no React, no I/O.
 */

export const PRE_ROUND_POLL_BASE_MS = 3000;
export const PRE_ROUND_POLL_CAP_MS = 10000;
/** Quiet “still trying” line after this many consecutive transient failures. */
export const PRE_ROUND_STILL_TRYING_AFTER = 3;

export type PlayLoadClass = "not_found" | "transient" | "terminal";

/**
 * Classify an HTTP status from GET …/play while pre-round.
 * 404 = no round yet (keep waiting). 403 = stop. 5xx / network-like = retry.
 */
export function classifyPlayLoadStatus(status: number): PlayLoadClass {
  if (status === 404) return "not_found";
  if (status === 403 || status === 401) return "terminal";
  if (status >= 500 || status === 429) return "transient";
  // Other 4xx: do not hammer; treat as terminal.
  if (status >= 400) return "terminal";
  return "transient";
}

/** Widen from 3s toward ~10s as consecutive transient failures grow. */
export function nextPreRoundPollIntervalMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return PRE_ROUND_POLL_BASE_MS;
  return Math.min(
    PRE_ROUND_POLL_CAP_MS,
    PRE_ROUND_POLL_BASE_MS * (1 + consecutiveFailures)
  );
}

export type PreRoundPollState = {
  hasEverLoaded: boolean;
  terminal: boolean;
  consecutiveFailures: number;
  pollIntervalMs: number;
  showStillTrying: boolean;
};

export function initialPreRoundPollState(): PreRoundPollState {
  return {
    hasEverLoaded: false,
    terminal: false,
    consecutiveFailures: 0,
    pollIntervalMs: PRE_ROUND_POLL_BASE_MS,
    showStillTrying: false,
  };
}

export type PreRoundFetchEvent =
  | { type: "not_found" }
  | { type: "success" }
  | { type: "transient" }
  | { type: "terminal" };

export function reducePreRoundPoll(
  state: PreRoundPollState,
  event: PreRoundFetchEvent
): PreRoundPollState {
  switch (event.type) {
    case "success":
      return {
        hasEverLoaded: true,
        terminal: false,
        consecutiveFailures: 0,
        pollIntervalMs: PRE_ROUND_POLL_BASE_MS,
        showStillTrying: false,
      };
    case "not_found":
      return {
        ...state,
        hasEverLoaded: false,
        terminal: false,
        consecutiveFailures: 0,
        pollIntervalMs: PRE_ROUND_POLL_BASE_MS,
        showStillTrying: false,
      };
    case "transient": {
      const consecutiveFailures = state.consecutiveFailures + 1;
      return {
        ...state,
        hasEverLoaded: false,
        terminal: false,
        consecutiveFailures,
        pollIntervalMs: nextPreRoundPollIntervalMs(consecutiveFailures),
        showStillTrying: consecutiveFailures >= PRE_ROUND_STILL_TRYING_AFTER,
      };
    }
    case "terminal":
      return {
        ...state,
        hasEverLoaded: false,
        terminal: true,
        showStillTrying: false,
      };
    default:
      return state;
  }
}

/** Whether the pre-round poll loop should keep running. */
export function shouldPollPreRound(state: PreRoundPollState): boolean {
  return !state.hasEverLoaded && !state.terminal;
}
