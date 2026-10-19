"use client";

const DEFAULT_PROMPT_1 = "What did you assume that turned out to be wrong?";
const DEFAULT_PROMPT_2 = "Where does that same assumption show up in how we work?";

type SessionReflectionViewProps = {
  prompt1?: string;
  prompt2?: string;
  /** Optional; shown after prompt2 when set. */
  prompt3?: string;
  /** Optional line the facilitator reads before the two questions. */
  preface?: string;
};

/**
 * Season reflection close — display-only discussion prompts.
 * Final screen after NPS. Nothing is typed or stored.
 */
export function SessionReflectionView({
  prompt1 = DEFAULT_PROMPT_1,
  prompt2 = DEFAULT_PROMPT_2,
  prompt3,
  preface,
}: SessionReflectionViewProps) {
  return (
    <main className="min-h-screen bg-warm-white px-5 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
        <header className="text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            Further reflection
          </h1>
          {preface ? (
            <p className="mt-6 text-left font-body text-lg text-charcoal">{preface}</p>
          ) : null}
        </header>

        <section>
          <h2 className="font-display text-2xl font-semibold leading-snug text-unmute-navy">
            {prompt1}
          </h2>
        </section>

        {prompt3 ? (
          <section>
            <h2 className="font-display text-2xl font-semibold leading-snug text-unmute-navy">
              {prompt2}
            </h2>
          </section>
        ) : null}

        <section className="space-y-8">
          <h2 className="font-display text-2xl font-semibold leading-snug text-unmute-navy">
            {prompt3 ?? prompt2}
          </h2>
          <p className="text-center font-body text-base text-slate">
            See you next week.
          </p>
        </section>
      </div>
    </main>
  );
}
