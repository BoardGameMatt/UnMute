"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { fetchGifs, type GiphyGif } from "@/lib/giphy";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { RESPONSE_MAX, type IkwymAction, type IkwymPlayState } from "../types";
import { PoweredByGiphy } from "./PoweredByGiphy";

type ViewsProps = {
  sessionId: string;
  state: IkwymPlayState;
  pending: boolean;
  error: string | null;
  send: (action: IkwymAction) => Promise<boolean>;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
      {children}
    </p>
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

function PromptCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        {title}
      </p>
      <div className="mt-3 font-display text-lg font-semibold text-unmute-navy">{children}</div>
    </div>
  );
}

function RosterChips({ roster }: { roster: IkwymPlayState["roster"] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {roster.map((row) => (
        <li
          key={row.participantId}
          className={`rounded-full px-3 py-1.5 font-display text-sm font-semibold ${
            row.submitted
              ? "bg-unmute-navy text-warm-white"
              : "border border-cloud-grey bg-warm-white text-unmute-navy"
          }`}
        >
          {row.displayName}
        </li>
      ))}
    </ul>
  );
}

const CollectionForm = ({
  state,
  pending,
  send,
}: {
  state: IkwymPlayState;
  pending: boolean;
  send: (action: IkwymAction) => Promise<boolean>;
}) => {
  const [checkin, setCheckin] = useState("");
  const [stimulus, setStimulus] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GiphyGif | null>(null);
  const canSearch = checkin.trim().length > 0 && stimulus.trim().length > 0;

  const search = async () => {
    if (!canSearch) return;
    setSearching(true);
    setSelected(null);
    const query = `${checkin.trim()} ${stimulus.trim()}`;
    const results = await fetchGifs(query, 9);
    setGifs(results);
    setSearching(false);
  };

  if (state.hasConfirmed) {
    return (
      <>
        <p className="text-center font-display text-xl font-semibold text-unmute-navy">
          You’re in. Waiting on the rest of the room.
        </p>
        <RosterChips roster={state.roster} />
        {state.isLead ? (
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            {state.confirmedCount} / {state.connectedCount} confirmed
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <PromptCard title="Check-in">{state.checkinPrompt}</PromptCard>
      <PromptCard title={state.stimulusLabel || "Stimulus"}>{state.stimulusPrompt}</PromptCard>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          Check-in answer
        </span>
        <input
          value={checkin}
          maxLength={RESPONSE_MAX}
          onChange={(e) => {
            setCheckin(e.target.value);
            setGifs(null);
            setSelected(null);
          }}
          className="mt-2 w-full rounded-md border border-cloud-grey bg-warm-white px-4 py-3 font-body text-charcoal"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          Stimulus answer
        </span>
        <input
          value={stimulus}
          maxLength={RESPONSE_MAX}
          onChange={(e) => {
            setStimulus(e.target.value);
            setGifs(null);
            setSelected(null);
          }}
          className="mt-2 w-full rounded-md border border-cloud-grey bg-warm-white px-4 py-3 font-body text-charcoal"
        />
      </label>
      <NavyButton disabled={!canSearch || searching || pending} onClick={() => void search()}>
        {searching ? "Searching…" : "Search GIFs"}
      </NavyButton>
      {gifs !== null ? (
        <>
          <p className="font-body text-sm leading-relaxed text-charcoal">
            Search results are unfiltered. Please select only responses that are appropriate for
            your team and align with your workplace standards.
          </p>
          {gifs.length === 0 ? (
            <p className="text-center font-display text-lg font-semibold text-unmute-navy">
              Search unavailable
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gifs.map((gif) => {
                const isOn = selected?.id === gif.id;
                return (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => setSelected(gif)}
                    className={`aspect-square overflow-hidden rounded-md border-2 ${
                      isOn ? "border-signal-amber" : "border-cloud-grey"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gif.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
          <PoweredByGiphy className="w-full" />
          <PrimaryButton
            disabled={!selected || pending}
            onClick={() => {
              if (!selected) return;
              void send({
                type: "confirmGif",
                gifUrl: selected.url,
                openResponse: checkin.trim(),
                stimulusResponse: stimulus.trim(),
                searchQuery: `${checkin.trim()} ${stimulus.trim()}`,
              });
            }}
          >
            Confirm GIF
          </PrimaryButton>
        </>
      ) : null}
    </>
  );
};

const RevealGif = ({
  url,
  roundLabel,
  checkin,
  stimulus,
}: {
  url: string;
  roundLabel: string | null;
  checkin: string;
  stimulus: string;
}) => {
  return (
    <div className="space-y-3">
      {roundLabel ? <Label>{roundLabel}</Label> : null}
      <p className="text-center font-body text-sm text-charcoal">{checkin}</p>
      <p className="text-center font-body text-sm text-charcoal">{stimulus}</p>
      <div className="overflow-hidden rounded-lg border border-cloud-grey bg-warm-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="mx-auto max-h-[28rem] w-full object-contain md:max-h-[36rem]" />
      </div>
      <PoweredByGiphy className="w-full" />
    </div>
  );
};

export function IkwymViews({ sessionId, state, pending, error, send }: ViewsProps) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(state.myGuessId);
  const [wrapArmed, setWrapArmed] = useState(false);
  const showPersistent =
    state.phase !== "SCOREBOARD" && state.phase !== "REVEAL_SHOW";
  const showProgress = state.phase === "REVEAL_GUESS" || state.phase === "REVEAL_SHOW";
  const lastGif = state.revealIndex >= state.revealTotal - 1 && state.revealTotal > 0;

  useEffect(() => {
    setPicked(state.myGuessId);
    setWrapArmed(false);
  }, [state.myGuessId, state.phase, state.revealIndex]);

  const onTimerComplete = useCallback(() => {
    void send({ type: "timerExpired" });
  }, [send]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-5">
      {showProgress ? <SessionProgressBar progress={state.progress} /> : null}
      <Label>I Know What You Meme</Label>
      {showPersistent ? (
        <p className="text-center font-body text-sm leading-relaxed text-slate">
          {state.persistentInstruction}
        </p>
      ) : null}
      {state.instruction ? (
        <p className="text-center font-display text-xl font-semibold text-unmute-navy">
          {state.instruction}
        </p>
      ) : null}

      {state.phase === "R1_PROMPTS" || state.phase === "R2_PROMPTS" ? (
        <>
          <Label>Round {state.round}</Label>
          {state.isLead ? (
            <>
              <PromptCard title="Check-in">{state.checkinPrompt}</PromptCard>
              <PromptCard title={state.stimulusLabel || "Stimulus"}>
                {state.stimulusPrompt}
              </PromptCard>
              <PrimaryButton
                disabled={pending || !state.canBroadcast}
                onClick={() => void send({ type: "broadcastRound" })}
              >
                Send to team
              </PrimaryButton>
            </>
          ) : null}
        </>
      ) : null}

      {state.phase === "R1_SELECTING" || state.phase === "R2_SELECTING" ? (
        <>
          <Label>Round {state.round}</Label>
          {state.isLead && !state.hasConfirmed ? (
            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              {state.confirmedCount} / {state.connectedCount} confirmed
            </p>
          ) : null}
          <CollectionForm state={state} pending={pending} send={send} />
        </>
      ) : null}

      {state.phase === "REVEAL_GUESS" || state.phase === "REVEAL_SHOW" ? (
        <>
          {state.isLead ? (
            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              GIF {state.revealIndex + 1} of {state.revealTotal}
              {state.phase === "REVEAL_GUESS"
                ? ` · ${state.lockedInCount} / ${state.eligibleCount} locked`
                : ""}
            </p>
          ) : null}
          {state.currentGifUrl ? (
            <RevealGif
              url={state.currentGifUrl}
              roundLabel={state.currentPromptLabel}
              checkin={state.checkinPrompt}
              stimulus={state.stimulusPrompt}
            />
          ) : null}
          {state.phase === "REVEAL_GUESS" && state.timerStartedAt && state.timerSeconds ? (
            <WaoPlayTimer
              durationSeconds={state.timerSeconds}
              startedAt={state.timerStartedAt}
              onComplete={onTimerComplete}
            />
          ) : null}

          {state.phase === "REVEAL_GUESS" && state.isOwner ? (
            <div className="rounded-lg bg-unmute-navy px-6 py-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-warm-white">
                Your GIF
              </p>
              <p className="mt-3 font-display text-lg font-semibold text-warm-white">
                Stay quiet. See if they can figure it out.
              </p>
            </div>
          ) : null}

          {state.phase === "REVEAL_GUESS" && !state.isOwner ? (
            <>
              <p className="hidden text-center font-body text-sm text-slate md:block">
                Guess on your phone — not out loud.
              </p>
              <ul className="flex flex-col gap-2">
                {state.guessOptions.map((option) => {
                  const selected = picked === option.participantId;
                  const locked = state.myGuessLocked && selected;
                  return (
                    <li key={option.participantId}>
                      <button
                        type="button"
                        disabled={state.myGuessLocked || pending}
                        onClick={() => setPicked(option.participantId)}
                        className={`flex w-full items-center rounded-md py-3 text-left font-display font-semibold text-unmute-navy ${
                          locked || selected
                            ? "border-2 border-unmute-navy bg-warm-white"
                            : "border border-unmute-navy/20 bg-warm-white"
                        }`}
                      >
                        <span
                          className={`flex flex-1 items-center justify-between px-4 ${
                            selected ? "border-l-4 border-unmute-navy pl-3" : ""
                          }`}
                        >
                          {option.displayName}
                          {locked ? <span aria-hidden="true">✓</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <PrimaryButton
                disabled={!picked || state.myGuessLocked || pending}
                onClick={() => {
                  if (!picked) return;
                  void send({ type: "lockGuess", guessedParticipantId: picked });
                }}
              >
                {state.myGuessLocked ? "Locked in" : "Lock in"}
              </PrimaryButton>
            </>
          ) : null}

          {state.phase === "REVEAL_SHOW" ? (
            <>
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                  It was
                </p>
                <p className="mt-2 font-display text-3xl font-bold text-unmute-navy">
                  {state.ownerName}
                </p>
              </div>
              {state.correctGuesserNames.length > 0 ? (
                <ul className="space-y-2">
                  {state.correctGuesserNames.map((name) => (
                    <li
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-cloud-grey bg-warm-white px-4 py-2"
                    >
                      <span className="font-display font-semibold text-unmute-navy">{name}</span>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-sunrise-gold font-display text-sm font-bold text-deep-navy"
                        aria-label="Correct"
                      >
                        ✓
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center font-body text-sm text-slate">Nobody locked the name.</p>
              )}
              {state.isLead ? (
                <>
                  {state.roster.length >= 11 ? (
                    <p className="text-center font-body text-sm text-slate">
                      Wrap after roughly one GIF per person, or sooner.
                    </p>
                  ) : null}
                  <PrimaryButton
                    disabled={pending || !state.canNext}
                    onClick={() => void send({ type: "nextReveal" })}
                  >
                    {lastGif ? "See scores" : "Next GIF"}
                  </PrimaryButton>
                  {wrapArmed ? (
                    <NavyButton
                      disabled={pending || !state.canWrap}
                      onClick={() => void send({ type: "wrap" })}
                    >
                      Confirm wrap
                    </NavyButton>
                  ) : (
                    <NavyButton disabled={pending || !state.canWrap} onClick={() => setWrapArmed(true)}>
                      Wrap things up
                    </NavyButton>
                  )}
                </>
              ) : (
                <p className="text-center font-body text-slate">Waiting for the facilitator.</p>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {state.phase === "SCOREBOARD" ? (
        <>
          <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
            Scores
          </h1>
          <ol className="space-y-2">
            {state.scores.map((row, index) => (
              <li
                key={row.participantId}
                className="flex items-center justify-between rounded-lg border border-cloud-grey bg-warm-white px-4 py-3"
              >
                <span className="font-display text-lg font-semibold text-unmute-navy">
                  {index + 1}. {row.displayName}
                </span>
                <span className="font-mono text-base text-unmute-navy">{row.score}</span>
              </li>
            ))}
          </ol>
          {state.isLead ? (
            <PrimaryButton
              disabled={pending || !state.canAdvanceRecap}
              onClick={() => {
                void send({ type: "advanceRecap" }).then((ok) => {
                  if (ok) router.replace(`/session/${sessionId}/feedback`);
                });
              }}
            >
              Continue
            </PrimaryButton>
          ) : (
            <p className="text-center font-body text-slate">
              Waiting for the facilitator to continue.
            </p>
          )}
        </>
      ) : null}

      {error ? (
        <p className="text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
