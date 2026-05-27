import type { Json } from "@/lib/types/database";

export const IKWYM_PROTOCOL_VERSION = 2 as const;

export type IKWYMPhase =
  | "round1_prompts"
  | "round1_selecting"
  | "round2_prompts"
  | "round2_selecting"
  | "reveal"
  | "complete";

export interface IKWYMParticipant {
  id: string;
  display_name: string;
}

export interface IKWYMStimulusCategory {
  label: string;
  prompt: string;
}

export interface IKWYMRoundPrompts {
  openPrompt: string;
  stimulusCategory: IKWYMStimulusCategory;
}

export interface IKWYMRoundResponse {
  gifUrl: string;
  searchQuery: string;
  openResponse: string;
  stimulusResponse: string;
}

export interface IKWYMRevealItem {
  participantId: string;
  round: 1 | 2;
  gifUrl: string;
  promptLabel: string;
}

export interface IKWYMState {
  version: typeof IKWYM_PROTOCOL_VERSION;
  phase: IKWYMPhase;
  participants: IKWYMParticipant[];
  round1Prompts: IKWYMRoundPrompts;
  round2Prompts: IKWYMRoundPrompts | null;
  round1Responses: Record<string, IKWYMRoundResponse>;
  round2Responses: Record<string, IKWYMRoundResponse>;
  revealQueue: IKWYMRevealItem[];
  revealIndex: number;
  /** revealIndex → voterId → guessedParticipantId */
  guesses: Record<string, Record<string, string>>;
  scores: Record<string, number>;
  timerStart: number | null;
  usedOpenPrompts: string[];
  usedStimulusCategories: string[];
  roundResolved: boolean;
  revealedOwnerId: string | null;
  correctGuessers: string[];
  session_complete: boolean;
}

export function isIKWYMState(json: unknown): json is IKWYMState {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return false;
  const o = json as Record<string, unknown>;
  return (
    o.version === IKWYM_PROTOCOL_VERSION &&
    typeof o.phase === "string" &&
    Array.isArray(o.participants)
  );
}

export function ikwymStateToJson(state: IKWYMState): Json {
  return JSON.parse(JSON.stringify(state)) as Json;
}
