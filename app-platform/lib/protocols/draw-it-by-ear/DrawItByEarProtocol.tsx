"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { returnToLobbyAction } from "@/app/(site)/session/[session_id]/lobby/actions";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { useGameState, useSessionContext } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { isTimedPhase } from "./engine";
import type { DibePhase } from "./types";
import { SessionIdentityBanner } from "@/lib/protocols/the-truth-is/components/SessionIdentityBanner";
import { BreakoutSetupView } from "./components/BreakoutSetupView";
import { DescribeView } from "./components/DescribeView";
import { FinalResultsView } from "./components/FinalResultsView";
import { ImageRevealView } from "./components/ImageRevealView";
import { LeadAdvanceControl } from "./components/LeadAdvanceControl";
import { LeaderboardView } from "./components/LeaderboardView";
import { LeadEndDrawingControl } from "./components/LeadEndDrawingControl";
import { LeadRoomStartControl } from "./components/LeadRoomStartControl";
import { MaterialsCheckView } from "./components/MaterialsCheckView";
import { ReturnToMainView } from "./components/ReturnToMainView";
import { RoundAggregateView } from "./components/RoundAggregateView";
import { RoundScoringView } from "./components/RoundScoringView";
import { ShowDrawingsView } from "./components/ShowDrawingsView";
import { TeamFormationView } from "./components/TeamFormationView";
import { TutorialResultsView } from "./components/TutorialResultsView";
import { TutorialScoringView } from "./components/TutorialScoringView";
import type { DibeCriterion, DibeImageCatalogEntry, DibeState } from "./types";
import { isDrawItByEarState } from "./types";

/**
 * Timed phases where a session-wide advance is meaningful.
 *
 * ROUND_DESCRIBE is excluded because its timer is per-room; the lead's recovery
 * there is LeadRoomStartControl. SHOW_DRAWINGS is excluded because it already
 * renders its own lead-only "Skip ahead". Both exclusions are mirrored by
 * leadAdvanceTimedPhase server-side, so hiding the control is not the guard.
 */
function hasLeadAdvanceControl(phase: DibePhase): boolean {
  if (phase === "ROUND_DESCRIBE" || phase === "SHOW_DRAWINGS") return false;
  return isTimedPhase(phase);
}

function parseCriteria(raw: unknown): DibeCriterion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is { text: string; points: number } =>
        c !== null &&
        typeof c === "object" &&
        typeof (c as { text?: unknown }).text === "string" &&
        typeof (c as { points?: unknown }).points === "number"
    )
    .map((c) => ({
      text: c.text,
      points: c.points as 1 | 2 | 3,
    }));
}

type ReturnToLobbyButtonProps = {
  sessionId: string;
  isReturning: boolean;
  onReturning: (returning: boolean) => void;
};

/**
 * Lead-only escape hatch from a session that started but never initialized.
 * Sends the session back to lobby status before navigating, otherwise the
 * lobby route bounces straight back here.
 */
const ReturnToLobbyButton = ({
  sessionId,
  isReturning,
  onReturning,
}: ReturnToLobbyButtonProps) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    onReturning(true);
    const result = await returnToLobbyAction(sessionId);
    if (result.ok) {
      router.push(`/session/${sessionId}/lobby`);
      return;
    }
    onReturning(false);
    setError(result.error ?? "Could not return to the lobby.");
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isReturning}
        className="inline-flex rounded-md border border-cloud-grey bg-transparent px-5 py-3 font-display text-base font-semibold text-unmute-navy shadow-sm transition hover:bg-cloud-grey/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Return to lobby
      </button>
      {error ? (
        <p className="font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const DrawItByEarProtocol = ({
  sessionId,
  participantId,
  role,
}: SessionProtocolProps) => {
  const { sendAction, currentParticipant, roleInSession } = useSessionContext();
  const { stateJson, isLoading } = useGameState();
  const [initError, setInitError] = useState<string | null>(null);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [rosterCount, setRosterCount] = useState(0);
  /** True once the lead has asked to go back to lobby; blocks re-initialization. */
  const [isReturning, setIsReturning] = useState(false);
  /** Bumped on session_participants INSERT so initializeGame retries without reload. */
  const [rosterVersion, setRosterVersion] = useState(0);

  const send = useCallback(
    (actionType: string, payload: object) => sendAction(actionType, payload),
    [sendAction]
  );

  // Phase views ignore the result; only the lead override controls need to know
  // whether a server guard no-opped the action.
  const sendVoid = useCallback(
    async (actionType: string, payload: object) => {
      await sendAction(actionType, payload);
    },
    [sendAction]
  );

  // Valid protocol state arriving over Realtime (e.g. another client initialized)
  // makes any prior initError stale — clear it so it cannot block render.
  useEffect(() => {
    if (isDrawItByEarState(stateJson)) {
      setInitError(null);
      setWaitingForPlayers(false);
    }
  }, [stateJson]);

  // Live roster: joins must re-trigger initializeGame on already-mounted clients.
  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      const { count } = await supabase
        .from("session_participants")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      setRosterCount(count ?? 0);
    })();

    const channel = supabase
      .channel(`dibe_init_roster:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          setRosterVersion((v) => v + 1);
          void (async () => {
            const { count } = await supabase
              .from("session_participants")
              .select("*", { count: "exact", head: true })
              .eq("session_id", sessionId);
            setRosterCount(count ?? 0);
          })();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (isLoading) return;
    if (isReturning) return;
    if (isDrawItByEarState(stateJson)) return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: participantRows, error: participantErr } = await supabase
        .from("session_participants")
        .select("participant_id, role_in_session, participants ( id, display_name )")
        .eq("session_id", sessionId);

      if (cancelled) return;
      if (participantErr || !participantRows?.length) {
        setWaitingForPlayers(false);
        setInitError("Could not load participants for this session.");
        return;
      }

      setRosterCount(participantRows.length);

      if (participantRows.length < 3) {
        setInitError(null);
        setWaitingForPlayers(true);
        return;
      }

      setWaitingForPlayers(false);

      const { data: imageRows, error: imageErr } = await supabase
        .from("protocol_images")
        .select("id, name, criteria")
        .eq("protocol_slug", "draw-it-by-ear");

      if (cancelled) return;
      if (imageErr || !imageRows?.length) {
        setInitError("Could not load image library.");
        return;
      }

      const typedRows = participantRows as {
        participant_id: string;
        role_in_session: string | null;
        participants:
          | { id: string; display_name: string }
          | { id: string; display_name: string }[]
          | null;
      }[];

      const participants = typedRows.map((row) => {
        const p = row.participants;
        const one = Array.isArray(p) ? p[0] : p;
        return {
          id: one?.id ?? row.participant_id,
          display_name: one?.display_name ?? "Player",
        };
      });

      const leadRow = typedRows.find((row) => row.role_in_session === "lead");
      const leadParticipantId = leadRow
        ? (Array.isArray(leadRow.participants)
            ? leadRow.participants[0]?.id
            : leadRow.participants?.id) ?? leadRow.participant_id
        : null;

      const imageCatalog: DibeImageCatalogEntry[] = imageRows.map((row) => ({
        id: row.id,
        name: row.name,
        criteria: parseCriteria(row.criteria),
      }));

      try {
        setInitError(null);
        await send("initializeGame", {
          participants,
          imageCatalog,
          leadParticipantId,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to start protocol.";
        if (/between 3 and 20|at least 3/i.test(message)) {
          setWaitingForPlayers(true);
          setInitError(null);
        } else {
          setWaitingForPlayers(false);
          setInitError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isReturning, stateJson, sessionId, send, rosterVersion]);

  // Valid state wins over any stale error — another client may have initialized.
  if (isDrawItByEarState(stateJson)) {
    // fall through to protocol render below
  } else if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5 font-body text-slate">
        Loading…
      </div>
    );
  } else if (waitingForPlayers || (rosterCount > 0 && rosterCount < 3)) {
    const here = Math.max(rosterCount, 1);
    console.log("DIBE_DEBUG", {
      roleInSession,
      rosterCount,
      waitingForPlayers,
      isReturning,
    });
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
          Almost ready
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold text-unmute-navy">
          Waiting for more participants
        </h1>
        <p className="mt-4 font-body text-lg text-slate">
          This protocol needs at least 3 people. {here}{" "}
          {here === 1 ? "person is" : "people are"} here so far. It will start
          automatically when enough have joined.
        </p>
        {roleInSession === "lead" ? (
          <ReturnToLobbyButton
            sessionId={sessionId}
            isReturning={isReturning}
            onReturning={setIsReturning}
          />
        ) : null}
      </div>
    );
  } else if (initError) {
    return (
      <div className="px-5 py-12">
        <p className="text-center font-body text-signal-red" role="alert">
          {initError}
        </p>
        {roleInSession === "lead" ? (
          <ReturnToLobbyButton
            sessionId={sessionId}
            isReturning={isReturning}
            onReturning={setIsReturning}
          />
        ) : null}
      </div>
    );
  } else {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5 font-body text-slate">
        Loading…
      </div>
    );
  }

  const state = stateJson as DibeState;

  // The engine snapshots its roster at initializeGame, so anyone whose
  // session_participants row was created after that point is unknown to it.
  // Show them a spectator screen rather than a view built around a team,
  // describer, or scoring slot they do not have.
  if (!state.participants.some((p) => p.id === participantId)) {
    return (
      <div className="min-h-screen bg-warm-white">
        <SessionIdentityBanner
          displayName={currentParticipant.display_name}
          roleInSession={roleInSession}
        />
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
            Already in progress
          </p>
          <h1 className="mt-4 font-display text-2xl font-bold text-unmute-navy">
            You joined after this session started
          </h1>
          <p className="mt-4 font-body text-lg text-slate">
            You&apos;re not in a breakout room for this run, so hang tight and
            watch along. You&apos;ll be in the next session from the start.
          </p>
        </div>
      </div>
    );
  }

  const isLead = role === "lead";
  const showProgress =
    state.phase !== "MATERIALS_CHECK" && state.phase !== "FINAL_RESULTS";
  const progress =
    state.progress_total_rounds > 0
      ? Math.min(1, state.total_rounds_played / state.progress_total_rounds)
      : 0;

  return (
    <div className="min-h-screen bg-warm-white">
      <SessionIdentityBanner
        displayName={currentParticipant.display_name}
        roleInSession={roleInSession}
      />
      {showProgress ? <SessionProgressBar progress={progress} /> : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={state.phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <PhaseBody
            state={state}
            sessionId={sessionId}
            participantId={participantId}
            role={role}
            send={sendVoid}
          />
        </motion.div>
      </AnimatePresence>

      {isLead && state.phase === "ROUND_DESCRIBE" ? (
        <>
          <LeadRoomStartControl state={state} sendAction={send} />
          <LeadEndDrawingControl state={state} sendAction={send} />
        </>
      ) : null}

      {isLead && hasLeadAdvanceControl(state.phase) ? (
        <LeadAdvanceControl phase={state.phase} sendAction={send} />
      ) : null}
    </div>
  );
};

type PhaseBodyProps = {
  state: DibeState;
  sessionId: string;
  participantId: string;
  role: SessionProtocolProps["role"];
  send: (actionType: string, payload: object) => Promise<void>;
};

const PhaseBody = ({ state, sessionId, participantId, role, send }: PhaseBodyProps) => {
  switch (state.phase) {
    case "MATERIALS_CHECK":
      return <MaterialsCheckView state={state} role={role} sendAction={send} />;
    case "TUTORIAL_DESCRIBE":
      return (
        <DescribeView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
          tutorial
        />
      );
    case "TUTORIAL_IMAGE_REVEAL":
      return (
        <ImageRevealView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
          heading="And here's the actual picture the describer was using."
        />
      );
    case "TUTORIAL_SCORING_1PT":
      return (
        <TutorialScoringView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "TUTORIAL_RESULTS":
      return (
        <TutorialResultsView state={state} role={role} sendAction={send} />
      );
    case "TEAM_FORMATION":
      return (
        <TeamFormationView
          state={state}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "BREAKOUT_SETUP":
      return (
        <BreakoutSetupView
          state={state}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "ROUND_DESCRIBE":
      return (
        <DescribeView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "ROUND_IMAGE_REVEAL":
      return (
        <ImageRevealView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
          heading="And here's the actual picture the describer was using."
        />
      );
    case "RETURN_TO_MAIN":
      return <ReturnToMainView state={state} role={role} sendAction={send} />;
    case "SHOW_DRAWINGS":
      return (
        <ShowDrawingsView
          state={state}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "ROUND_SCORING_1PT":
    case "ROUND_SCORING_2PT":
    case "ROUND_SCORING_3PT":
      return (
        <RoundScoringView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "ROUND_AGGREGATE":
      return (
        <RoundAggregateView state={state} role={role} sendAction={send} />
      );
    case "LEADERBOARD":
      return <LeaderboardView state={state} role={role} sendAction={send} />;
    case "FINAL_RESULTS":
      return <FinalResultsView state={state} role={role} sendAction={send} />;
    default:
      return (
        <p className="px-5 py-8 text-center font-body text-slate">Unknown phase.</p>
      );
  }
};

export default DrawItByEarProtocol;
