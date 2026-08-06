"use client";

import { motion } from "framer-motion";
import type { WaoRevealItem, WaoRevealState } from "@/lib/wao/types";

type WaoRevealViewProps = {
  reveal: WaoRevealState;
};

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
};

const BucketList = ({
  title,
  subtitle,
  items,
  tone,
}: {
  title: string;
  subtitle: string;
  items: WaoRevealItem[];
  tone: "success" | "danger" | "mine" | "theirs";
}) => {
  if (items.length === 0) return null;

  let shell = "rounded-lg border px-4 py-4 ";
  if (tone === "success") {
    shell += "border-unmute-navy bg-unmute-navy text-warm-white";
  } else if (tone === "danger") {
    shell += "border-signal-red bg-warm-white text-charcoal";
  } else if (tone === "mine") {
    shell += "border-2 border-unmute-navy border-l-4 bg-warm-white text-charcoal";
  } else {
    shell +=
      "border-2 border-dashed border-unmute-navy bg-warm-white text-charcoal";
  }

  return (
    <section className={shell}>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p
        className={`mt-1 font-body text-sm ${
          tone === "success" ? "text-cloud-grey" : "text-slate"
        }`}
      >
        {subtitle}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="font-body text-base font-medium">
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
};

export function WaoRevealView({ reveal }: WaoRevealViewProps) {
  const partnerLabel = reveal.isSolo
    ? null
    : reveal.partnerDisplayName ?? "your partner";

  return (
    <main className="min-h-screen bg-warm-white">
      <motion.div
        className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-6"
        {...fade}
      >
        <header className="space-y-2 text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-steel-blue">
            Round reveal
          </p>
          {reveal.isSolo ? (
            <p className="font-body text-sm text-slate">
              Solo round — half value.
            </p>
          ) : (
            <p className="font-body text-base text-charcoal">
              With{" "}
              <span className="font-display font-semibold text-unmute-navy">
                {partnerLabel}
              </span>
            </p>
          )}
          <h1 className="font-display text-2xl font-bold leading-tight text-unmute-navy sm:text-3xl">
            {reveal.categoryTitle}
          </h1>
        </header>

        <div className="flex flex-col gap-3">
          <BucketList
            title="You both eliminated — and you were right"
            subtitle="Scored together."
            items={reveal.buckets.bothCorrectElimination}
            tone="success"
          />
          <BucketList
            title="You both eliminated — but it belonged"
            subtitle="This zeroed the round. No partial credit."
            items={reveal.buckets.bothButBelonged}
            tone="danger"
          />
          <BucketList
            title="Only you eliminated — and you were right"
            subtitle={
              partnerLabel
                ? `${partnerLabel} did not confirm.`
                : "No partner this round."
            }
            items={reveal.buckets.onlyYouRight}
            tone="mine"
          />
          <BucketList
            title={
              partnerLabel
                ? `Only ${partnerLabel} eliminated — and they were right`
                : "Only your partner eliminated — and they were right"
            }
            subtitle="You did not confirm."
            items={reveal.buckets.onlyPartnerRight}
            tone="theirs"
          />
        </div>

        <section className="space-y-3 border-t border-cloud-grey pt-5 text-center">
          <p className="font-display text-4xl font-bold text-unmute-navy">
            {reveal.score}
            <span className="ml-2 font-body text-base font-normal text-slate">
              points
            </span>
          </p>

          {!reveal.isSolo && reveal.lott > 0 ? (
            <p className="font-body text-base text-charcoal">
              You left{" "}
              <span className="font-display font-semibold text-unmute-navy">
                {reveal.lott}
              </span>{" "}
              points on the table.
            </p>
          ) : null}

          {!reveal.isSolo && reveal.hadSave ? (
            <p className="font-body text-base text-charcoal">
              {partnerLabel ? (
                <>
                  <span className="font-display font-semibold text-unmute-navy">
                    {partnerLabel}
                  </span>
                  &apos;s caution saved you from a zero.
                </>
              ) : (
                "Your partner's caution saved you from a zero."
              )}
            </p>
          ) : null}

          {!reveal.isSolo && reveal.exactMatch ? (
            <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
              Exact match this round
            </p>
          ) : null}
        </section>
      </motion.div>
    </main>
  );
}
