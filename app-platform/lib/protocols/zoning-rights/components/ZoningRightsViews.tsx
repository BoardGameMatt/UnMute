"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { assignmentComplete, clearAssignmentBuilding, moveAssignment } from "../engine";
import type { Assignment, Cell, ZoningRightsAction, ZoningRightsPlayState } from "../types";
import { BuildingTray } from "./BuildingTray";
import { CityMap, type LotMark } from "./CityMap";

type ViewsProps = {
  sessionId: string;
  state: ZoningRightsPlayState;
  pending: boolean;
  error: string | null;
  send: (action: ZoningRightsAction) => Promise<boolean>;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
      {children}
    </p>
  );
}

function RoleChip({ label, name }: { label: string; name: string | null }) {
  if (!name) return null;
  return (
    <div className="rounded-md border border-unmute-navy bg-warm-white px-3 py-3 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">{label}</p>
      <p className="mt-1 font-display text-base font-semibold text-unmute-navy">{name}</p>
    </div>
  );
}

function RoleStrip({ state }: { state: ZoningRightsPlayState }) {
  if (state.phase === "TEAM_INTRO" || state.phase === "SCOREBOARD") return null;
  if (!state.plannerName && !state.zmName && !state.leadDeveloperName) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <RoleChip label="City Planner" name={state.plannerName} />
      <RoleChip label="Zoning Manager" name={state.zmName} />
      {state.leadDeveloperName ? (
        <div className="col-span-2">
          <RoleChip label="Lead Developer" name={state.leadDeveloperName} />
        </div>
      ) : null}
    </div>
  );
}

function PrimaryButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-signal-amber px-6 py-3 font-display text-base font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NavyButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-unmute-navy px-6 py-3 font-display text-base font-semibold text-warm-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function namesFromAssignment(
  assignment: Assignment,
  buildings: ZoningRightsPlayState["buildings"]
): Record<string, string> {
  const lotNames: Record<string, string> = {};
  for (const [letter, id] of Object.entries(assignment)) {
    const name = buildings.find((b) => b.id === id)?.name;
    if (name) lotNames[letter] = name;
  }
  return lotNames;
}

function MapPlacement({
  state,
  assignment,
  onChange,
  disabled,
  lotMarks,
  lotGuessNames,
}: {
  state: ZoningRightsPlayState;
  assignment: Assignment;
  onChange: (next: Assignment) => void;
  disabled?: boolean;
  lotMarks?: Record<string, LotMark>;
  lotGuessNames?: Record<string, string>;
}) {
  const [held, setHeld] = useState<string | null>(null);
  const lotNames = namesFromAssignment(assignment, state.buildings);

  const place = (letter: string, buildingId?: string) => {
    if (disabled) return;
    const id = buildingId || held;
    if (!id) return;
    onChange(moveAssignment(assignment, id, letter));
    setHeld(null);
  };

  const returnLetter = (letter: string) => {
    if (disabled) return;
    const id = assignment[letter];
    if (!id) return;
    if (held && held !== id) {
      place(letter, held);
      return;
    }
    onChange(clearAssignmentBuilding(assignment, id));
    setHeld(null);
  };

  return (
    <>
      <CityMap
        occupied={state.occupied}
        legalLots={[]}
        selectedLots={[]}
        lots={state.lots}
        lotNames={lotNames}
        lotGuessNames={lotGuessNames}
        lotMarks={lotMarks}
        canPick={false}
        canPlace={!disabled}
        heldBuildingId={held}
        onPlaceLetter={place}
        onReturnLetter={returnLetter}
      />
      {!disabled ? (
        <BuildingTray
          buildings={state.buildings}
          assignment={assignment}
          heldId={held}
          onHold={setHeld}
        />
      ) : null}
    </>
  );
}

const ZmAssign = ({
  state,
  pending,
  send,
}: {
  state: ZoningRightsPlayState;
  pending: boolean;
  send: (action: ZoningRightsAction) => Promise<boolean>;
}) => {
  const [assignment, setAssignment] = useState<Assignment>(state.zmAssignment ?? {});
  const ready = assignmentComplete(assignment, state.k);
  return (
    <>
      {state.isLead ? (
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-6 text-center">
          <Label>Facilitator</Label>
          <p className="mt-3 font-display text-lg font-semibold text-unmute-navy">
            Unshare your screen. Make your selections in private.
          </p>
        </div>
      ) : null}
      <MapPlacement state={state} assignment={assignment} onChange={setAssignment} />
      <PrimaryButton
        disabled={pending || !ready}
        onClick={() => {
          void send({ type: "lockZmAssignment", assignment });
        }}
      >
        Lock in
      </PrimaryButton>
    </>
  );
};

const GuessAssign = ({
  state,
  pending,
  send,
}: {
  state: ZoningRightsPlayState;
  pending: boolean;
  send: (action: ZoningRightsAction) => Promise<boolean>;
}) => {
  const [assignment, setAssignment] = useState<Assignment>(state.myGuess ?? {});
  const ready = assignmentComplete(assignment, state.k);

  useEffect(() => {
    setAssignment(state.myGuess ?? {});
  }, [state.phase]);

  const onChange = (next: Assignment) => {
    setAssignment(next);
    if (state.canGuess) void send({ type: "placeGuess", assignment: next });
  };

  return (
    <>
      <MapPlacement
        state={state}
        assignment={assignment}
        onChange={onChange}
        disabled={!state.canGuess}
      />
      {state.canGuess ? (
        <PrimaryButton
          disabled={pending || !ready}
          onClick={() => {
            void send({ type: "lockGuess", assignment });
          }}
        >
          Lock in
        </PrimaryButton>
      ) : null}
    </>
  );
};

const TeamLock = ({
  state,
  pending,
  send,
}: {
  state: ZoningRightsPlayState;
  pending: boolean;
  send: (action: ZoningRightsAction) => Promise<boolean>;
}) => {
  const [assignment, setAssignment] = useState<Assignment>(state.teamGuess ?? {});
  const ready = assignmentComplete(assignment, state.k);
  return (
    <>
      <Label>Lead Developer</Label>
      <MapPlacement
        state={state}
        assignment={assignment}
        onChange={(next) => {
          setAssignment(next);
          void send({ type: "placeTeamGuess", assignment: next });
        }}
      />
      {ready ? (
        <PrimaryButton
          disabled={pending}
          onClick={() => {
            void send({ type: "lockTeam", assignment });
          }}
        >
          Lock it in
        </PrimaryButton>
      ) : null}
    </>
  );
};

export function ZoningRightsViews({ sessionId, state, pending, error, send }: ViewsProps) {
  const router = useRouter();
  const [draftLots, setDraftLots] = useState<Cell[]>(state.selectedLots);

  useEffect(() => {
    if (state.phase === "SCOREBOARD") {
      router.replace(`/session/${sessionId}/zoning-rights-scoreboard`);
    }
  }, [router, sessionId, state.phase]);

  useEffect(() => {
    setDraftLots(state.selectedLots);
  }, [state.phase]);

  useEffect(() => {
    if (!state.canPickLots) setDraftLots(state.selectedLots);
  }, [state.canPickLots, state.selectedLots]);

  useEffect(() => {
    if (!state.isLead || pending) return;
    if (state.phase !== "TEAM_REVEAL" && state.phase !== "IND_REVEAL") return;
    if (state.canAnotherRound || state.canContinue || state.canMoveToTeamPlay) return;
    if (!state.canWrapUp) return;
    const id = window.setTimeout(() => {
      void send({ type: "complete" });
    }, 1800);
    return () => window.clearTimeout(id);
  }, [
    pending,
    send,
    state.canAnotherRound,
    state.canContinue,
    state.canMoveToTeamPlay,
    state.canWrapUp,
    state.isLead,
    state.phase,
  ]);

  const picking = state.phase === "IND_PLANNER_PICK" || state.phase === "TEAM_PLANNER_PICK";
  const selectedLots = state.canPickLots && picking ? draftLots : state.selectedLots;
  const placing =
    state.canAssignZm ||
    state.canGuess ||
    state.canTeamLock ||
    (state.myGuessLocked && state.phase === "IND_GUESS" && state.viewerRole !== "zoning_manager");

  const toggleLot = (cell: Cell) => {
    const exists = selectedLots.some((c) => c.col === cell.col && c.row === cell.row);
    const next = exists
      ? selectedLots.filter((c) => !(c.col === cell.col && c.row === cell.row))
      : [...selectedLots, cell].slice(0, state.k);
    setDraftLots(next);
    void send({ type: "selectLots", cells: next });
  };

  const showOffCamera =
    state.viewerRole === "zoning_manager" &&
    (state.phase === "IND_GUESS" || state.phase === "TEAM_DISCUSS" || state.phase === "TEAM_LOCK");

  const revealAssignment =
    state.phase === "IND_REVEAL" || state.phase === "TEAM_REVEAL"
      ? (state.zmAssignment ?? {})
      : state.phase === "TEAM_DISCUSS" || state.phase === "TEAM_LOCK"
        ? (state.teamGuess ?? {})
        : {};
  const revealNames = namesFromAssignment(revealAssignment, state.buildings);

  const teamMarks: Record<string, LotMark> | undefined =
    state.phase === "TEAM_REVEAL" && state.zmAssignment
      ? Object.fromEntries(
          state.lots.map((lot) => {
            const truth = state.zmAssignment?.[lot.letter];
            const guess = state.teamGuess?.[lot.letter];
            return [lot.letter, truth && guess && truth === guess ? "hit" : "miss"];
          })
        )
      : undefined;
  const teamGuessNames =
    state.phase === "TEAM_REVEAL" && state.teamGuess
      ? namesFromAssignment(state.teamGuess, state.buildings)
      : undefined;

  const showDefaultMap =
    state.phase !== "TEAM_INTRO" && !placing && !state.canAssignZm && !showOffCamera;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pb-16">
      <SessionProgressBar progress={state.progress} />
      <header className="space-y-3 text-center">
        <Label>Zoning Rights</Label>
        <RoleStrip state={state} />
        {state.instruction ? (
          <p className="font-display text-lg font-semibold text-unmute-navy sm:text-xl">
            {state.instruction}
          </p>
        ) : null}
      </header>

      {state.timerStartedAt && state.timerSeconds ? (
        <div className="flex justify-center">
          <WaoPlayTimer
            durationSeconds={state.timerSeconds}
            startedAt={state.timerStartedAt}
            onComplete={() => {
              void send({ type: "timerExpired" });
            }}
          />
        </div>
      ) : null}

      {showDefaultMap ? (
        <CityMap
          occupied={state.occupied}
          legalLots={state.canPickLots ? state.legalLots : []}
          selectedLots={state.canPickLots ? selectedLots : []}
          lots={state.lots}
          lotNames={revealNames}
          lotGuessNames={teamGuessNames}
          lotMarks={teamMarks}
          canPick={state.canPickLots}
          onToggle={toggleLot}
        />
      ) : null}

      {state.canPickLots ? (
        <p className="text-center font-body text-sm text-charcoal">
          Select {state.k} lots. {selectedLots.length} of {state.k} chosen.
        </p>
      ) : null}

      {showOffCamera ? (
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-6 text-center">
          <Label>Zoning Manager</Label>
          <p className="mt-3 font-display text-xl font-semibold text-unmute-navy">
            Camera off. Mute yourself.
          </p>
          <p className="mt-2 font-body text-sm text-slate">
            {state.phase === "IND_GUESS"
              ? "Come back when everyone has locked in."
              : "Come back when the two-minute timer ends."}
          </p>
        </div>
      ) : null}

      {state.canAssignZm ? <ZmAssign state={state} pending={pending} send={send} /> : null}

      {(state.canGuess || (state.myGuessLocked && state.phase === "IND_GUESS")) &&
      state.viewerRole !== "zoning_manager" ? (
        <GuessAssign state={state} pending={pending} send={send} />
      ) : null}

      {state.phase === "IND_GUESS" && state.isLead ? (
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          {state.lockedInCount} of {state.guesserCount} locked in
        </p>
      ) : null}

      {state.canTeamLock ? <TeamLock state={state} pending={pending} send={send} /> : null}

      {(state.phase === "TEAM_DISCUSS" || state.phase === "TEAM_LOCK") &&
      !state.canTeamLock &&
      state.viewerRole !== "zoning_manager" ? (
        <p className="text-center font-body text-sm text-slate">
          Watch {state.leadDeveloperName ?? "the Lead Developer"} place the team&apos;s choice.
        </p>
      ) : null}

      {state.phase === "IND_REVEAL" ? (
        <div className="space-y-3 text-center">
          <Label>Got it</Label>
          {state.exactMatchNames.length > 0 ? (
            <p className="font-display text-xl font-semibold text-unmute-navy">
              {state.exactMatchNames.join(" · ")}
            </p>
          ) : (
            <p className="font-body text-sm text-slate">No exact matches this round.</p>
          )}
        </div>
      ) : null}

      {state.phase === "TEAM_REVEAL" ? (
        <p className="text-center font-display text-2xl font-semibold text-unmute-navy">
          {state.teamHit ? "The team got it" : "Not this time"}
        </p>
      ) : null}

      {state.canPickLots ? (
        <PrimaryButton
          disabled={pending || selectedLots.length !== state.k}
          onClick={() => {
            void send({ type: "lockLots", cells: selectedLots });
          }}
        >
          Lock lots
        </PrimaryButton>
      ) : null}

      {state.canContinue ? (
        <PrimaryButton disabled={pending} onClick={() => void send({ type: "continue" })}>
          Continue
        </PrimaryButton>
      ) : null}

      {state.canAnotherRound || state.canMoveToTeamPlay || state.canWrapUp ? (
        <div className="space-y-3">
          {state.canAnotherRound ? (
            <NavyButton disabled={pending} onClick={() => void send({ type: "anotherRound" })}>
              Another round
            </NavyButton>
          ) : null}
          {state.canMoveToTeamPlay ? (
            state.canContinue ? (
              <NavyButton disabled={pending} onClick={() => void send({ type: "moveToTeamPlay" })}>
                Move to team play
              </NavyButton>
            ) : (
              <PrimaryButton disabled={pending} onClick={() => void send({ type: "moveToTeamPlay" })}>
                Move to team play
              </PrimaryButton>
            )
          ) : null}
          {state.canWrapUp ? (
            <PrimaryButton disabled={pending} onClick={() => void send({ type: "complete" })}>
              Wrap things up
            </PrimaryButton>
          ) : null}
        </div>
      ) : null}

      {state.isLead && state.phase === "IND_REVEAL" ? (
        <button
          type="button"
          className="text-center font-body text-xs text-slate underline"
          onClick={() => void send({ type: "complete" })}
        >
          End session
        </button>
      ) : null}

      {error ? (
        <p className="text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
