"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { BRIEFING_PANELS, highlightSongTitle } from "@/lib/cover-story/briefing";
import { formatRevealDate, isRevealDay, lastPlantDate } from "@/lib/cover-story/format";
import type { CoverStoryPlayState } from "@/lib/cover-story/types";
import type { CoverStoryAction } from "@/lib/cover-story/types";
import { COVER_STORY_NOTE_MAX } from "@/lib/cover-story/types";
import { CoverStoryRevealExplainer } from "./CoverStoryLobbyExplainer";

type Send = (action: CoverStoryAction) => Promise<boolean>;

const EASE = [0.4, 0, 0.2, 1] as const;

function Shell({
  children,
  label = "Cover Story",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-4">
      <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        {label}
      </p>
      {children}
    </div>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
  compact,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        compact
          ? "rounded-md border border-cloud-grey px-4 py-2 font-display text-sm font-semibold text-unmute-navy transition hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
          : "w-full rounded-md border border-cloud-grey bg-transparent px-6 py-3 font-display font-semibold text-unmute-navy transition hover:bg-cloud-grey disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

function fieldRosterStatus(
  row: CoverStoryPlayState["leadField"][number],
  phase: CoverStoryPlayState["phase"]
): string {
  if (row.locked) return "Ready";
  if (!row.hasDeal) return "No card";
  if (phase === "deal") return "Choosing";
  return "No pick yet";
}

function FacilitatorSkipToReflection({
  pending,
  send,
}: {
  pending: boolean;
  send: Send;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-cloud-grey bg-warm-white p-4">
        <p className="font-body text-sm text-charcoal">
          This will exit the moment and go directly to the discussion questions.
        </p>
        <div className="flex flex-col gap-2">
          <AmberButton
            disabled={pending}
            onClick={() => void send({ type: "skipToReflection" })}
          >
            Yes, skip to discussion
          </AmberButton>
          <GhostButton disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <GhostButton disabled={pending} onClick={() => setConfirming(true)}>
        Skip to discussion
      </GhostButton>
    </div>
  );
}

function LeadFieldRosterRow({
  row,
  phase,
  pending,
  send,
}: {
  row: CoverStoryPlayState["leadField"][number];
  phase: CoverStoryPlayState["phase"];
  pending: boolean;
  send: Send;
}) {
  const [locking, setLocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const status = fieldRosterStatus(row, phase);

  const copyPickLink = async () => {
    if (!row.pickUrl) return;
    try {
      await navigator.clipboard.writeText(row.pickUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <li className="rounded-md border border-cloud-grey/80 px-3 py-2">
      <div className="flex items-start justify-between gap-3 font-body text-sm">
        <div>
          <span className="text-charcoal">{row.displayName}</span>
          {row.locked && row.lockedAgencyName ? (
            <p className="mt-0.5 font-body text-xs text-slate">{row.lockedAgencyName}</p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          {status}
        </span>
      </div>
      {!row.locked && row.hasDeal && row.pickCards ? (
        <div className="mt-2 space-y-2">
          {row.pickUrl ? (
            <GhostButton compact disabled={pending} onClick={() => void copyPickLink()}>
              {copied ? "Link copied" : "Copy private pick link"}
            </GhostButton>
          ) : null}
          {locking ? (
            <div className="space-y-2">
              {row.pickCards.map((card) => (
                <button
                  key={card.agencyId}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void send({
                      type: "lockAgencyOnBehalf",
                      participantId: row.id,
                      agencyId: card.agencyId,
                    })
                  }
                  className="w-full rounded-md border border-cloud-grey bg-warm-white px-3 py-2 text-left font-body text-sm text-charcoal hover:bg-cloud-grey disabled:opacity-40"
                >
                  Lock {card.name}
                </button>
              ))}
              <GhostButton compact disabled={pending} onClick={() => setLocking(false)}>
                Cancel
              </GhostButton>
            </div>
          ) : (
            <GhostButton compact disabled={pending} onClick={() => setLocking(true)}>
              Lock for them
            </GhostButton>
          )}
        </div>
      ) : null}
    </li>
  );
}

function LeadLabel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-cloud-grey bg-warm-white p-5">
      <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Facilitator
      </p>
      {children}
    </div>
  );
}

function AmberButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NavyButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-unmute-navy px-6 py-3 font-display font-semibold text-white hover:bg-deep-navy disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Passage({
  index,
  insights,
}: {
  index: number;
  insights: boolean;
}) {
  const panel = BRIEFING_PANELS[index] ?? BRIEFING_PANELS[0];
  const highlighted = insights ? highlightSongTitle(panel.body, panel.song) : null;
  return (
    <article className="rounded-lg border border-cloud-grey bg-warm-white p-6 shadow-sm sm:p-7">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        {index + 1} of 5
      </p>
      {highlighted ? (
        <p className="font-body text-base leading-relaxed text-unmute-navy">
          {highlighted.before}
          <span className="font-bold text-signal-amber">{highlighted.title}</span>
          {highlighted.after}
        </p>
      ) : (
        <p className="font-body text-base leading-relaxed text-charcoal">{panel.body}</p>
      )}
    </article>
  );
}

export function CoverStoryPlayViews({
  state,
  pending,
  error,
  send,
  reload,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  error: string | null;
  send: Send;
  reload: () => Promise<void>;
}) {
  return (
    <>
      {error ? (
        <p className="px-5 text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
      {state.phase === "lobby" ? (
        <LobbyWait state={state} pending={pending} send={send} />
      ) : null}
      {state.phase === "reading" ? (
        <ReadingView state={state} pending={pending} send={send} />
      ) : null}
      {state.phase === "discuss" || state.phase === "insights" ? (
        <PlaybackView state={state} pending={pending} send={send} />
      ) : null}
      {state.phase === "deal" ||
      (state.phase === "field" && !state.deal?.locked) ? (
        <DealView state={state} pending={pending} send={send} />
      ) : null}
      {state.phase === "field" && Boolean(state.deal?.locked) ? (
        <FieldView state={state} pending={pending} send={send} />
      ) : null}
      {state.phase === "reveal" || state.phase === "complete" ? (
        <RevealView state={state} pending={pending} send={send} reload={reload} />
      ) : null}
    </>
  );
}

function LobbyWait({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  return (
    <Shell>
      <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
        Cover Story
      </h1>
      <p className="text-center font-body text-slate">
        {state.revealOn
          ? `Reveal on ${formatRevealDate(state.revealOn)}.`
          : "The lead still needs to set the reveal date."}
      </p>
      {state.isLead ? (
        <LeadLabel>
          <p className="mb-4 font-body text-sm text-slate">
            Start the reading when everyone is in the room.
          </p>
          <AmberButton disabled={pending || !state.revealOn} onClick={() => void send({ type: "startReading" })}>
            Begin reading
          </AmberButton>
        </LeadLabel>
      ) : (
        <p className="text-center font-body text-slate">Waiting for the lead to begin.</p>
      )}
    </Shell>
  );
}

function ReadingView({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const index = state.reading.screenIndex;
  const go = (next: number, done = false) => {
    void send({ type: "setReadingProgress", screenIndex: next, done });
  };

  return (
    <Shell>
      <p className="text-center font-body text-sm text-slate">
        Read silently. You will discuss once everyone is through.
      </p>
      <Passage index={index} insights={false} />
      <div className="flex gap-3">
        <GhostButton disabled={index <= 0 || pending} onClick={() => go(index - 1)}>
          Back
        </GhostButton>
        {index < 4 ? (
          <div className="flex-1">
            <NavyButton disabled={pending} onClick={() => go(index + 1)}>
              Next
            </NavyButton>
          </div>
        ) : (
          <div className="flex-1">
            <AmberButton disabled={pending || state.reading.done} onClick={() => go(4, true)}>
              {state.reading.done ? "Done" : "I’m done"}
            </AmberButton>
          </div>
        )}
      </div>
      {state.isLead ? (
        <LeadLabel>
          <ul className="mb-4 space-y-2">
            {state.reading.others.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-2">
                <span className="font-body text-sm text-charcoal">{person.displayName}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                  {person.done ? "Done" : `Screen ${person.screenIndex + 1}`}
                </span>
                {person.done ? null : (
                  <GhostButton
                    disabled={pending}
                    onClick={() => void send({ type: "forceAdvanceReader", participantId: person.id })}
                  >
                    Mark done
                  </GhostButton>
                )}
              </li>
            ))}
          </ul>
          <AmberButton
            disabled={pending}
            onClick={() => void send({ type: "gateDiscussion" })}
          >
            Everyone’s done — discuss
          </AmberButton>
        </LeadLabel>
      ) : state.reading.done ? (
        <p className="text-center font-body text-slate">Waiting for the rest of the room.</p>
      ) : null}
    </Shell>
  );
}

function PlaybackView({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const index = state.reading.playbackIndex;
  const insights = state.phase === "insights" || state.reading.insightsOn;
  return (
    <Shell>
      <p className="text-center font-body text-sm text-slate">
        {insights
          ? "The titles were hiding in ordinary sentences."
          : "What did you notice? What insights are you taking back to the team?"}
      </p>
      <Passage index={index} insights={insights} />
      {state.isLead ? (
        <LeadLabel>
          <div className="mb-4 flex gap-3">
            <GhostButton
              disabled={index <= 0 || pending}
              onClick={() => void send({ type: "setPlayback", playbackIndex: index - 1, insightsOn: insights })}
            >
              Back
            </GhostButton>
            <GhostButton
              disabled={index >= 4 || pending}
              onClick={() => void send({ type: "setPlayback", playbackIndex: index + 1, insightsOn: insights })}
            >
              Next
            </GhostButton>
          </div>
          {state.phase === "discuss" ? (
            <AmberButton disabled={pending} onClick={() => void send({ type: "openInsights" })}>
              Show insights
            </AmberButton>
          ) : (
            <AmberButton disabled={pending} onClick={() => void send({ type: "openDeal" })}>
              Deal cover cards
            </AmberButton>
          )}
        </LeadLabel>
      ) : (
        <p className="text-center font-body text-slate">The lead is driving the screens.</p>
      )}
    </Shell>
  );
}

function CopyMissionButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <GhostButton
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? "Copied" : "Copy to clipboard"}
    </GhostButton>
  );
}

function MissionLockedSheet({ state }: { state: CoverStoryPlayState }) {
  const revealLabel = formatRevealDate(state.revealOn);
  return (
    <>
      <h1 className="font-display text-2xl font-bold text-unmute-navy">Your cover</h1>
      <p className="font-body text-slate">
        You have until {revealLabel} to speak each word at least once, in a meeting with at
        least two other people from this session. Keep a private note of the date, who was
        there, and a little context. You will file that proof at the reveal — not before.
      </p>
      <p className="font-display text-xl text-unmute-navy">{state.deal?.lockedAgencyName}</p>
      <ul className="space-y-2">
        {(state.deal?.words ?? []).map((word) => (
          <li
            key={word.wordId}
            className="rounded-lg border border-cloud-grey bg-warm-white px-4 py-3 font-body text-charcoal"
          >
            {word.phrase}
          </li>
        ))}
      </ul>
      <p className="font-body text-sm text-slate">
        The best agents get caught by about half the room. Too obvious, and everyone sees it.
        Too opaque, and nobody does. Aim for the middle.
      </p>
      {state.deal?.copyPaste ? (
        <>
          <textarea
            readOnly
            value={state.deal.copyPaste}
            className="min-h-[160px] w-full rounded-md border border-cloud-grey bg-warm-white p-3 font-mono text-xs text-charcoal"
          />
          <CopyMissionButton text={state.deal.copyPaste} />
        </>
      ) : null}
      <p className="text-center font-display text-lg font-semibold text-unmute-navy">
        See you on {revealLabel}.
      </p>
      <p className="text-center font-body text-sm text-slate">
        Nothing else to do here until then. Keep this screen off any shared display.
      </p>
    </>
  );
}

function DealView({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const cards = state.deal?.cards ?? [];
  const lockedCount = state.leadField.filter((row) => row.locked).length;

  if (state.deal?.locked && !state.isLead) {
    return (
      <Shell>
        <MissionLockedSheet state={state} />
      </Shell>
    );
  }

  return (
    <Shell>
      {state.isLead && !state.deal?.locked ? (
        <p className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 p-4 font-body text-sm text-unmute-navy">
          Stop sharing this screen before you pick. Your cover is only secret if the room
          cannot see it.
        </p>
      ) : null}
      {state.deal?.locked && state.isLead ? (
        <p className="font-body text-sm text-slate">
          Your cover is locked on this device. Do not project it.
        </p>
      ) : null}
      {!state.deal?.locked ? (
        <>
          <h1 className="font-display text-2xl font-bold text-unmute-navy">Pick your agency</h1>
          <p className="font-body text-slate">
            You will see three covers. Lock one. Do not tell anyone what you picked.
          </p>
          <p className="font-body text-sm text-slate">
            This is a mission. It runs until {formatRevealDate(state.revealOn)}. Speak each
            word in a meeting with at least two other people from this session. Spoken words
            only. Virtual meetings count. Do not name your agency. Keep a private record of
            the date, who was there, and a little context — you will file that proof at the
            reveal. There is nothing to log in the product until then.
          </p>
          {cards.length === 0 ? (
            <p className="text-center font-body text-slate">Preparing your covers…</p>
          ) : (
            <div className="space-y-3">
              {cards.map((card) => {
                const selectedCard = selected === card.agencyId;
                return (
                  <button
                    type="button"
                    key={card.agencyId}
                    onClick={() => setSelected(card.agencyId)}
                    className={`w-full rounded-lg border bg-warm-white p-6 text-left shadow-sm ${
                      selectedCard ? "border-2 border-unmute-navy" : "border-cloud-grey"
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                      Agency
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold text-unmute-navy">
                      {card.name}
                    </p>
                    <ul className="mt-3 space-y-1 font-body text-sm text-charcoal">
                      {card.words.map((word) => (
                        <li key={word}>{word}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}
          <AmberButton
            disabled={pending || selected == null}
            onClick={() => {
              if (selected == null) return;
              void send({ type: "lockAgency", agencyId: selected });
            }}
          >
            Finalize pick
          </AmberButton>
        </>
      ) : null}
      {state.isLead ? (
        <LeadLabel>
          <p className="mb-3 font-body text-sm text-slate">
            {lockedCount} of {state.leadField.length} agents are ready.
          </p>
          <ul className="mb-4 space-y-2">
            {state.leadField.map((row) => (
              <LeadFieldRosterRow
                key={row.id}
                row={row}
                phase={state.phase}
                pending={pending}
                send={send}
              />
            ))}
          </ul>
          {state.phase === "deal" ? (
            <AmberButton disabled={pending} onClick={() => void send({ type: "openField" })}>
              Start the mission
            </AmberButton>
          ) : null}
        </LeadLabel>
      ) : null}
    </Shell>
  );
}

function FieldView({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const [lateName, setLateName] = useState("");
  const revealLabel = formatRevealDate(state.revealOn);
  const revealReady = isRevealDay(state.revealOn);

  return (
    <Shell>
      {state.isLead ? (
        <LeadLabel>
          <p className="mb-2 font-body text-sm text-slate">
            Agents are in the field until {revealLabel}. There is nothing to log in the
            product until Sitting B.
          </p>
          <ul className="mb-4 space-y-2">
            {state.leadField.map((row) => (
              <LeadFieldRosterRow
                key={row.id}
                row={row}
                phase={state.phase}
                pending={pending}
                send={send}
              />
            ))}
          </ul>
          <p className="mb-2 font-body text-sm text-charcoal">Admit late</p>
          <input
            value={lateName}
            onChange={(event) => setLateName(event.target.value)}
            placeholder="Display name"
            className="mb-3 w-full rounded-md border border-cloud-grey px-3 py-2"
          />
          <NavyButton
            disabled={pending || !lateName.trim()}
            onClick={() => void send({ type: "admitLate", displayName: lateName.trim() })}
          >
            Admit and deal cards
          </NavyButton>
          <div className="mt-4 space-y-2 font-body text-xs text-slate">
            <p>
              T−7: One week until Cover Story reveal on {revealLabel}. Speak any words you
              still owe, in a meeting with at least two other people from this session.
            </p>
            <p>
              T−2: Cover Story reveal is on {revealLabel}. Finish the mission. Do not name
              your agency. You will file proof at the reveal.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            <p className="font-body text-sm text-charcoal">
              On reveal day ({revealLabel}), start Sitting B here. This does not reveal anyone&apos;s
              cover early — it only opens the mission-report and guessing flow when the field
              period is over.
            </p>
            <AmberButton
              disabled={pending || !revealReady}
              onClick={() => void send({ type: "startReveal" })}
            >
              Start Sitting B on reveal day
            </AmberButton>
            {!revealReady ? (
              <p className="font-body text-xs text-slate">
                Available on {revealLabel}. Agents keep their covers private until then.
              </p>
            ) : null}
          </div>
          <FacilitatorSkipToReflection pending={pending} send={send} />
        </LeadLabel>
      ) : (
        <MissionLockedSheet state={state} />
      )}
    </Shell>
  );
}

function MissionReportView({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const words = state.deal?.words ?? state.field?.words ?? [];
  const others = state.members.filter((person) => person.id !== state.participantId);
  const plantBy = lastPlantDate(state.revealOn);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      words.map((word) => [
        word.wordId,
        {
          skipped: word.status === "not_planted",
          plantedOn: word.plantedOn ?? "",
          witnessIds: word.witnessIds,
          note: word.note,
        },
      ])
    )
  );

  const ready =
    words.length === 5 &&
    words.every((word) => {
      const row = rows[word.wordId];
      if (!row) return false;
      if (row.skipped) return true;
      return Boolean(row.plantedOn) && row.witnessIds.length >= 2;
    });

  if (words.length !== 5) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold text-unmute-navy">No cover to file</h1>
        <p className="font-body text-slate">Sit tight. The room is filing mission proof.</p>
        {state.isLead ? <MissionLeadGate state={state} pending={pending} send={send} /> : null}
      </Shell>
    );
  }

  if (state.reveal?.missionSubmitted) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold text-unmute-navy">Mission filed</h1>
        <p className="font-body text-slate">
          Sit tight. The facilitator will start guessing when the room is ready.
        </p>
        {state.isLead ? <MissionLeadGate state={state} pending={pending} send={send} /> : null}
      </Shell>
    );
  }

  return (
    <Shell>
      <CoverStoryRevealExplainer />
      <h1 className="font-display text-2xl font-bold text-unmute-navy">File your mission</h1>
      <p className="font-body text-slate">
        For each word, either mark didn’t plant, or enter the date, at least two people who
        were there, and a little context.
      </p>
      <div className="space-y-4">
        {words.map((word) => {
          const row = rows[word.wordId] ?? {
            skipped: false,
            plantedOn: "",
            witnessIds: [] as string[],
            note: "",
          };
          return (
            <section key={word.wordId} className="rounded-lg border border-cloud-grey bg-warm-white p-5">
              <p className="font-display text-lg text-unmute-navy">{word.phrase}</p>
              <label className="mt-3 flex items-center gap-2 font-body text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={row.skipped}
                  onChange={(event) =>
                    setRows((current) => ({
                      ...current,
                      [word.wordId]: { ...row, skipped: event.target.checked },
                    }))
                  }
                />
                Didn’t plant
              </label>
              {row.skipped ? null : (
                <div className="mt-3 space-y-3">
                  <label className="block font-body text-sm text-charcoal">
                    Date
                    <input
                      type="date"
                      max={plantBy}
                      value={row.plantedOn}
                      onChange={(event) =>
                        setRows((current) => ({
                          ...current,
                          [word.wordId]: { ...row, plantedOn: event.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-cloud-grey px-3 py-2"
                    />
                  </label>
                  <div>
                    <p className="mb-2 font-body text-sm text-charcoal">Who was there</p>
                    <p className="mb-2 font-body text-xs text-slate">
                      Toggle everyone who was in that meeting, including the facilitator. Need
                      two yeses, or check Didn’t plant.
                    </p>
                    <ul className="space-y-2">
                      {others.map((person) => {
                        const on = row.witnessIds.includes(person.id);
                        return (
                          <li key={person.id} className="flex items-center justify-between">
                            <span className="font-body text-sm text-charcoal">
                              {person.displayName}
                              {person.isLead ? " (facilitator)" : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRows((current) => {
                                  const next = new Set(row.witnessIds);
                                  if (on) next.delete(person.id);
                                  else next.add(person.id);
                                  return {
                                    ...current,
                                    [word.wordId]: { ...row, witnessIds: Array.from(next) },
                                  };
                                })
                              }
                              className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
                                on
                                  ? "bg-unmute-navy text-white"
                                  : "border border-cloud-grey text-steel-blue"
                              }`}
                            >
                              {on ? "Yes" : "No"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {!row.skipped && row.witnessIds.length < 2 ? (
                      <p className="mt-2 font-body text-xs text-slate">
                        Need two other people, or check Didn’t plant.
                      </p>
                    ) : null}
                  </div>
                  <label className="block font-body text-sm text-charcoal">
                    Context
                    <input
                      maxLength={COVER_STORY_NOTE_MAX}
                      value={row.note}
                      onChange={(event) =>
                        setRows((current) => ({
                          ...current,
                          [word.wordId]: { ...row, note: event.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-cloud-grey px-3 py-2"
                    />
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                      {row.note.length} / {COVER_STORY_NOTE_MAX}
                    </span>
                  </label>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <AmberButton
        disabled={pending || !ready}
        onClick={() =>
          void send({
            type: "submitMissionReport",
            words: words.map((word) => {
              const row = rows[word.wordId];
              if (!row || row.skipped) {
                return { wordId: word.wordId, status: "not_planted" as const, note: row?.note };
              }
              return {
                wordId: word.wordId,
                status: "planted" as const,
                plantedOn: row.plantedOn,
                witnessIds: row.witnessIds,
                note: row.note,
              };
            }),
          })
        }
      >
        Submit mission
      </AmberButton>
      {state.isLead ? <MissionLeadGate state={state} pending={pending} send={send} /> : null}
    </Shell>
  );
}

function MissionLeadGate({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const roster = state.reveal?.missionRoster ?? [];
  const done = roster.filter((row) => row.submitted).length;
  return (
    <LeadLabel>
      <p className="mb-3 font-body text-sm text-slate">
        {done} of {roster.length} agents have filed their mission.
      </p>
      <ul className="mb-4 space-y-2">
        {roster.map((row) => (
          <li key={row.id} className="flex justify-between font-body text-sm">
            <span>{row.displayName}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              {row.submitted ? "Filed" : "Writing"}
            </span>
          </li>
        ))}
      </ul>
      <AmberButton disabled={pending} onClick={() => void send({ type: "beginGuessing" })}>
        Begin guessing
      </AmberButton>
    </LeadLabel>
  );
}

function RevealView({
  state,
  pending,
  send,
  reload,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
  reload: () => Promise<void>;
}) {
  const reveal = state.reveal;
  if (!reveal) return null;

  const skipControl =
    state.isLead && state.phase === "reveal" ? (
      <FacilitatorSkipToReflection pending={pending} send={send} />
    ) : null;

  if (reveal.subphase === "final" || state.phase === "complete") {
    return <FinalBoard state={state} pending={pending} send={send} />;
  }

  if (reveal.subphase === "mission") {
    return (
      <>
        <MissionReportView state={state} pending={pending} send={send} />
        {skipControl}
      </>
    );
  }

  if (reveal.subphase === "guess") {
    return (
      <>
        <GuessView state={state} pending={pending} send={send} reload={reload} />
        {skipControl}
      </>
    );
  }

  if (reveal.subphase === "gallery") {
    return (
      <>
        <Shell>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            {reveal.target?.displayName}
          </h1>
          <p className="text-center font-body text-slate">What the room guessed. No truth yet.</p>
          <ul className="space-y-3">
            {reveal.gallery.map((row, index) => (
              <li
                key={`${row.agencyText}-${index}`}
                className="rounded-lg border border-cloud-grey bg-warm-white p-4"
              >
                <p className="font-display text-lg text-unmute-navy">{row.agencyText}</p>
                <p className="font-body text-sm text-slate">{row.evidenceText}</p>
              </li>
            ))}
          </ul>
          {state.isLead ? (
            <LeadLabel>
              <AmberButton disabled={pending} onClick={() => void send({ type: "revealCover" })}>
                Reveal their cover
              </AmberButton>
            </LeadLabel>
          ) : (
            <p className="text-center font-body text-slate">The lead will reveal when you are ready.</p>
          )}
        </Shell>
        {skipControl}
      </>
    );
  }

  if (reveal.subphase === "mark") {
    return (
      <>
        <MarkView state={state} pending={pending} send={send} />
        {skipControl}
      </>
    );
  }

  if (reveal.subphase === "board") {
    return (
      <>
        <Shell>
          <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
            {reveal.target?.displayName}
          </h1>
          <p className="text-center font-display text-2xl text-signal-amber">
            {reveal.board?.agencyName}
          </p>
          <ul className="space-y-2">
            {(reveal.board?.words ?? []).map((word) => (
              <li
                key={word.phrase}
                className="rounded-lg border border-cloud-grey bg-warm-white px-4 py-3 font-body text-charcoal"
              >
                <p>
                  {word.phrase}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                    {word.planted ? "Planted" : "Didn’t plant"}
                  </span>
                </p>
                {word.planted && word.plantedOn ? (
                  <p className="mt-1 font-body text-sm text-slate">{word.plantedOn}</p>
                ) : null}
                {word.planted && word.witnessNames.length > 0 ? (
                  <p className="mt-1 font-body text-sm text-slate">
                    {word.witnessNames.join(", ")}
                  </p>
                ) : null}
                {word.note ? (
                  <p className="mt-1 font-body text-sm text-slate">{word.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-center font-body text-slate">
            Take a minute. How did the words get in?
          </p>
          {state.isLead ? (
            <LeadLabel>
              <AmberButton disabled={pending} onClick={() => void send({ type: "openScoring" })}>
                Score guesses
              </AmberButton>
            </LeadLabel>
          ) : null}
        </Shell>
        {skipControl}
      </>
    );
  }

  if (reveal.subphase === "points" && reveal.points) {
    return (
      <>
        <Shell>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            Points just awarded
          </h1>
          <p className="text-center font-body text-slate">{reveal.points.agentName}</p>
          <p className="text-center font-display text-4xl text-unmute-navy">
            {reveal.points.type1 + reveal.points.mission}
          </p>
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Type 1 {reveal.points.type1} · Mission {reveal.points.mission}
          </p>
          <ul className="space-y-2">
            {reveal.points.guessers.map((row) => (
              <li key={row.name} className="flex justify-between font-body text-sm">
                <span>{row.name}</span>
                <span>+{row.delta}</span>
              </li>
            ))}
          </ul>
          {state.isLead ? (
            <LeadLabel>
              <AmberButton disabled={pending} onClick={() => void send({ type: "nextTarget" })}>
                Next person
              </AmberButton>
            </LeadLabel>
          ) : null}
        </Shell>
        {skipControl}
      </>
    );
  }

  return skipControl;
}

function GuessView({
  state,
  pending,
  send,
  reload,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
  reload: () => Promise<void>;
}) {
  const reveal = state.reveal;
  const [agency, setAgency] = useState(reveal?.myGuess?.agencyText ?? "");
  const [evidence, setEvidence] = useState(reveal?.myGuess?.evidenceText ?? "");
  const [windowClosed, setWindowClosed] = useState(false);
  useEffect(() => {
    setWindowClosed(false);
  }, [reveal?.target?.id, reveal?.guessStartedAt]);
  if (!reveal?.target) return null;
  const isSelf = reveal.target.id === state.participantId;
  const timedOut =
    windowClosed ||
    (Boolean(reveal.guessStartedAt) &&
      Date.now() >=
        new Date(reveal.guessStartedAt as string).getTime() + reveal.guessDurationSeconds * 1000);
  const canGuess = !isSelf && !timedOut && !reveal.myGuess?.submitted;

  return (
    <Shell>
      <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
        {reveal.target.displayName}
      </h1>
      <p className="text-center font-body text-slate">
        Name their agency. Do not talk. The facilitator will advance.
      </p>
      <div className="flex justify-center">
        <WaoPlayTimer
          durationSeconds={reveal.guessDurationSeconds}
          startedAt={reveal.guessStartedAt}
          urgentBelowSeconds={0}
          numericBelowSeconds={0}
          onComplete={() => {
            setWindowClosed(true);
            void reload();
          }}
        />
      </div>
      {isSelf ? (
        <div className="space-y-2 text-center">
          <p className="font-display text-2xl font-semibold text-unmute-navy">Sit tight.</p>
          <p className="font-body text-slate">
            The room is naming your agency. You are not guessing this round — that is on purpose.
          </p>
        </div>
      ) : timedOut || reveal.myGuess?.submitted ? (
        <p className="text-center font-body text-slate">
          {reveal.myGuess?.submitted ? "Locked in." : "Time is up. Guessing is closed for this person."}
        </p>
      ) : (
        <>
          <label className="font-body text-sm text-charcoal">
            Agency
            <input
              maxLength={50}
              value={agency}
              onChange={(event) => setAgency(event.target.value)}
              disabled={!canGuess}
              className="mt-1 w-full rounded-md border border-cloud-grey px-3 py-2"
            />
          </label>
          <label className="font-body text-sm text-charcoal">
            Why
            <textarea
              maxLength={250}
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              disabled={!canGuess}
              className="mt-1 min-h-[96px] w-full rounded-md border border-cloud-grey px-3 py-2"
            />
          </label>
          <AmberButton
            disabled={pending || !canGuess || !agency.trim()}
            onClick={() =>
              void send({ type: "submitGuess", agencyText: agency, evidenceText: evidence })
            }
          >
            Submit guess
          </AmberButton>
        </>
      )}
      {state.isLead ? (
        <LeadLabel>
          <p className="mb-3 font-body text-sm text-slate">
            {reveal.submittedCount} of {reveal.guesserCount} guesses in.
          </p>
          <ul className="mb-4 space-y-2">
            {reveal.guessRoster.map((row) => (
              <li key={row.id} className="flex justify-between font-body text-sm">
                <span>{row.displayName}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                  {row.submitted ? "In" : "Writing"}
                </span>
              </li>
            ))}
          </ul>
          <NavyButton disabled={pending} onClick={() => void send({ type: "closeGuessWindow" })}>
            Close guesses
          </NavyButton>
          <div className="mt-3">
            <GhostButton disabled={pending} onClick={() => void send({ type: "skipTarget" })}>
              Skip for now
            </GhostButton>
          </div>
        </LeadLabel>
      ) : null}
    </Shell>
  );
}

function MarkView({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const reveal = state.reveal;
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const row of reveal?.marks ?? []) {
      next[row.guessId] = row.markedCorrect ?? row.suggestedCorrect;
    }
    setMarks(next);
  }, [reveal?.marks]);

  if (!state.isLead) {
    return (
      <Shell>
        <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
          {reveal?.target?.displayName}
        </h1>
        <p className="text-center font-body text-slate">
          The facilitator is scoring. Sit tight.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
        {reveal?.target?.displayName}
      </h1>
      <p className="text-center font-body text-slate">Mark which guesses are correct.</p>
      <ul className="space-y-3">
        {(reveal?.marks ?? []).map((row) => (
          <li key={row.guessId} className="rounded-lg border border-cloud-grey bg-warm-white p-4">
            <p className="font-display text-lg text-unmute-navy">{row.agencyText}</p>
            <p className="font-body text-sm text-slate">{row.evidenceText}</p>
            <p className="mt-1 font-body text-xs text-slate">{row.guesserName}</p>
            <label className="mt-2 flex items-center gap-2 font-body text-sm">
              <input
                type="checkbox"
                checked={marks[row.guessId] ?? false}
                onChange={(event) =>
                  setMarks((current) => ({ ...current, [row.guessId]: event.target.checked }))
                }
              />
              Correct
              {row.suggestedCorrect ? (
                <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                  Suggested
                </span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
      <LeadLabel>
        <AmberButton
          disabled={pending}
          onClick={() => {
            void (async () => {
              const saved = await send({
                type: "setMarks",
                marks: Object.entries(marks).map(([guessId, markedCorrect]) => ({
                  guessId,
                  markedCorrect,
                })),
              });
              if (saved) await send({ type: "finalizeTarget" });
            })();
          }}
        >
          Show points
        </AmberButton>
      </LeadLabel>
    </Shell>
  );
}

function FinalBoard({
  state,
  pending,
  send,
}: {
  state: CoverStoryPlayState;
  pending: boolean;
  send: Send;
}) {
  const rows = useMemo(() => {
    const list = [...(state.reveal?.final ?? [])];
    list.sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...list.map((row) => row.total));
    return list.map((row) => ({ ...row, width: `${Math.round((row.total / max) * 100)}%` }));
  }, [state.reveal?.final]);

  return (
    <Shell>
      <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
        Final board
      </h1>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <motion.li
            key={row.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: index * 0.12 }}
            className="rounded-lg border border-cloud-grey bg-warm-white p-4"
          >
            <div className="mb-2 flex justify-between">
              <span className="font-display text-lg text-unmute-navy">{row.name}</span>
              <span className="font-display text-xl text-unmute-navy">{row.total}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-cloud-grey">
              <motion.div
                className="h-full bg-unmute-navy"
                initial={{ width: 0 }}
                animate={{ width: row.width }}
                transition={{ duration: 0.55, ease: EASE, delay: index * 0.12 }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              Type 1 {row.type1} · Guesses {row.type2} · Mission {row.mission}
            </p>
          </motion.li>
        ))}
      </ul>
      {state.isLead && state.phase !== "complete" ? (
        <LeadLabel>
          <AmberButton disabled={pending} onClick={() => void send({ type: "completeSession" })}>
            Continue to discussion
          </AmberButton>
        </LeadLabel>
      ) : null}
    </Shell>
  );
}
