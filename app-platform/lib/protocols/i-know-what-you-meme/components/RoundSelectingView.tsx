"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchGifs, type GiphyGif } from "@/lib/giphy";
import type { SessionParticipantRole } from "@/lib/types/database";
import type { IKWYMState, IKWYMRoundPrompts } from "../types";
import { ParticipantChipRoster } from "./RoundPromptView";

type RoundSelectingViewProps = {
  state: IKWYMState;
  round: 1 | 2;
  prompts: IKWYMRoundPrompts;
  responses: Record<string, { gifUrl: string }>;
  participantId: string;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const RoundSelectingView = ({
  state,
  round,
  prompts,
  responses,
  participantId,
  role,
  sendAction,
}: RoundSelectingViewProps) => {
  const submittedIds = Object.keys(responses);
  const hasSubmitted = Boolean(responses[participantId]?.gifUrl);
  const allSubmitted = state.participants.every((p) => Boolean(responses[p.id]?.gifUrl));

  const submitAction =
    round === 1 ? "ikwym/submit_round1_gif" : "ikwym/submit_round2_gif";

  if (hasSubmitted) {
    return (
      <div className="min-h-[70vh] px-5 py-10">
        <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          ROUND {round}
        </p>
        <h1 className="mt-4 text-center font-display text-2xl font-bold text-unmute-navy">
          GIF locked in
        </h1>
        <p className="mt-3 text-center font-body text-sm text-slate">
          Waiting for everyone else to confirm their GIF…
        </p>
        <ParticipantChipRoster
          participants={state.participants}
          submittedIds={submittedIds}
          className="mt-8"
        />
        {role === "lead" && allSubmitted ? (
          <p className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-signal-amber">
            Everyone&apos;s in — advancing…
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <GifPickerForm
      round={round}
      prompts={prompts}
      participantId={participantId}
      submitAction={submitAction}
      sendAction={sendAction}
      roster={
        <ParticipantChipRoster
          participants={state.participants}
          submittedIds={submittedIds}
          className="mt-8"
        />
      }
    />
  );
};

type GifPickerFormProps = {
  round: 1 | 2;
  prompts: IKWYMRoundPrompts;
  participantId: string;
  submitAction: string;
  sendAction: (type: string, payload: object) => Promise<void>;
  roster: ReactNode;
};

const GifPickerForm = ({
  round,
  prompts,
  participantId,
  submitAction,
  sendAction,
  roster,
}: GifPickerFormProps) => {
  const [openResponse, setOpenResponse] = useState("");
  const [stimulusResponse, setStimulusResponse] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const searchQuery = `${openResponse.trim()} ${stimulusResponse.trim()}`.trim();
  const selected = gifs.find((g) => g.id === selectedId);
  const canSearch = openResponse.trim().length > 0 && stimulusResponse.trim().length > 0;

  useEffect(() => {
    if (!searched || !canSearch) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const results = await fetchGifs(searchQuery, 9);
      if (!cancelled) {
        setGifs(results);
        setLoading(false);
        setSelectedId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searched, searchQuery, canSearch]);

  const handleSearch = () => {
    if (!canSearch) return;
    setSearched(true);
  };

  const handleConfirm = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    await sendAction(submitAction, {
      participantId,
      gifUrl: selected.url,
      searchQuery,
      openResponse: openResponse.trim(),
      stimulusResponse: stimulusResponse.trim(),
    });
  };

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        ROUND {round}
      </p>

      <div className="mx-auto mt-6 max-w-md space-y-4">
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-5 shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Check-in
          </p>
          <p className="mt-1 font-display text-base font-medium text-charcoal">
            {prompts.openPrompt}
          </p>
          <input
            type="text"
            value={openResponse}
            onChange={(e) => {
              setOpenResponse(e.target.value);
              setSearched(false);
            }}
            maxLength={120}
            className="mt-3 w-full rounded-md border border-cloud-grey px-4 py-3 font-body text-base text-charcoal focus:border-unmute-navy focus:outline-none"
            placeholder="Your answer"
          />
        </div>
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-5 shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            {prompts.stimulusCategory.label}
          </p>
          <p className="mt-1 font-display text-base font-medium text-charcoal">
            {prompts.stimulusCategory.prompt}
          </p>
          <input
            type="text"
            value={stimulusResponse}
            onChange={(e) => {
              setStimulusResponse(e.target.value);
              setSearched(false);
            }}
            maxLength={120}
            className="mt-3 w-full rounded-md border border-cloud-grey px-4 py-3 font-body text-base text-charcoal focus:border-unmute-navy focus:outline-none"
            placeholder="Your answer"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={!canSearch || loading}
        onClick={handleSearch}
        className="mx-auto mt-6 block w-full max-w-md rounded-md bg-unmute-navy px-5 py-3 font-display text-sm font-semibold text-warm-white hover:bg-deep-navy disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Searching…" : "Search GIFs"}
      </button>

      {searched ? (
        <>
          <div
            className="mx-auto mt-6 max-w-lg rounded-lg border border-signal-amber bg-signal-amber/10 px-4 py-3"
            role="alert"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-signal-amber">
              Content notice
            </p>
            <p className="mt-1 font-body text-sm text-charcoal">
              Search results are unfiltered. Please select only responses that are
              appropriate for your team and align with your workplace standards.
            </p>
          </div>

          {loading ? (
            <p className="mt-6 text-center font-body text-slate">Searching…</p>
          ) : gifs.length === 0 ? (
            <p className="mt-6 text-center font-body text-slate">Search unavailable</p>
          ) : (
            <ul className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-2">
              {gifs.map((gif) => {
                const isSelected = selectedId === gif.id;
                return (
                  <li key={gif.id}>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setSelectedId(gif.id)}
                      className={`aspect-square w-full overflow-hidden rounded-md border-2 transition-colors ${
                        isSelected
                          ? "border-signal-amber"
                          : "border-cloud-grey hover:border-unmute-navy"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gif.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            disabled={!selected || submitting}
            onClick={() => void handleConfirm()}
            className="mx-auto mt-8 block w-full max-w-md rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Confirming…" : "Confirm GIF"}
          </button>
        </>
      ) : null}

      {roster}
    </div>
  );
};
