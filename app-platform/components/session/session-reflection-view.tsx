"use client";

const PROMPT_1 = "What did you assume that turned out to be wrong?";
const PROMPT_2 =
  "Where does that same assumption show up in how we work?";

/**
 * Season reflection close — display-only discussion prompts.
 * Final screen after NPS (WAO, Cover Story). Nothing is typed or stored.
 */
export function SessionReflectionView() {
  return (
    <main className="min-h-screen bg-warm-white px-5 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
        <header className="text-center">
          <h1 className="font-display text-3xl font-bold text-unmute-navy">
            Further reflection
          </h1>
        </header>

        <section>
          <h2 className="font-display text-2xl font-semibold leading-snug text-unmute-navy">
            {PROMPT_1}
          </h2>
        </section>

        <section className="space-y-8">
          <h2 className="font-display text-2xl font-semibold leading-snug text-unmute-navy">
            {PROMPT_2}
          </h2>
          <p className="text-center font-body text-base text-slate">
            See you next week.
          </p>
        </section>
      </div>
    </main>
  );
}
