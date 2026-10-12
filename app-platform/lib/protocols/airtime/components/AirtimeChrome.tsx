"use client";

import { useEffect, useState } from "react";
import type { DiverStatus } from "../types";

export const EASE = [0.4, 0, 0.2, 1] as const;

export const BANNER = {
  diver: "You're underwater. Stay on mute. Hand signals only.",
  crew: "You're on the surface. You can unmute and talk to your divers.",
  waiting: "Your boat is back. Waiting for the other boats.",
  shared: "Underwater: stay on mute, hand signals only. On the surface: talk to your divers.",
  open: "Everyone can unmute.",
} as const;

export const REVEAL_LINE = "Boats win. Your score is everything your boat brought up.";
export const END_BANNER = "The dive ends after this turn.";

export const RULES = [
  "Bring up as much treasure as you can.",
  "Your boat shares one oxygen tank. Divers underwater use air every turn, and the deeper you are, the more you use.",
  "Each turn, dive deeper or swim back up. Deeper treasure is worth much more.",
  "If your boat's air runs out while you're underwater, you lose your treasure from that dive.",
  "Underwater, no talking (hand signals are fine), and you only see a rough air gauge. Once you surface, you can talk.",
] as const;

/** Server-aligned clock, ticking a few times a second. */
export function useServerNow(clockOffsetMs: number, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs);
  useEffect(() => {
    setNow(Date.now() + clockOffsetMs);
    const id = window.setInterval(() => setNow(Date.now() + clockOffsetMs), intervalMs);
    return () => window.clearInterval(id);
  }, [clockOffsetMs, intervalMs]);
  return now;
}

export function isBefore(nowMs: number, iso: string | null): boolean {
  if (!iso) return false;
  return nowMs < new Date(iso).getTime();
}

export function ProtocolLabel({ dive }: { dive?: number }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Airtime{dive ? ` · Dive ${dive}` : ""}
      </p>
      <p className="font-body text-sm text-slate">Bring up as much treasure as you can.</p>
    </div>
  );
}

export function Banner({ children, tone = "navy" }: { children: React.ReactNode; tone?: "navy" | "amber" }) {
  return (
    <div
      className={`rounded-lg px-4 py-3 font-body text-sm font-medium ${
        tone === "amber"
          ? "border border-signal-amber bg-signal-amber/10 text-deep-navy"
          : "bg-unmute-navy text-warm-white"
      }`}
      role="status"
    >
      {children}
    </div>
  );
}

export function DepthGauge({ depth }: { depth: number }) {
  return (
    <div className="flex flex-col items-center gap-1" aria-label={`Depth ${depth} of 6`}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Depth</p>
      {[1, 2, 3, 4, 5, 6].map((level) => (
        <span
          key={level}
          className={`flex h-7 w-10 items-center justify-center rounded-sm font-mono text-[11px] ${
            level === depth
              ? "bg-unmute-navy text-warm-white"
              : level < depth
                ? "bg-steel-blue/20 text-steel-blue"
                : "border border-cloud-grey text-slate"
          }`}
        >
          {level}
        </span>
      ))}
    </div>
  );
}

const CHIP_GLYPH: Record<DiverStatus, string> = {
  underwater: "↓",
  surfaced: "↑",
  lost: "×",
  forfeit: "×",
};

export function BoatmateChip({ name, status }: { name: string; status: DiverStatus }) {
  const style =
    status === "underwater"
      ? "border border-dashed border-unmute-navy text-unmute-navy"
      : status === "surfaced"
        ? "bg-unmute-navy text-warm-white"
        : "border border-cloud-grey text-slate opacity-60";
  const label = status === "underwater" ? "underwater" : status === "surfaced" ? "on the surface" : status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-sm ${style}`}
      aria-label={`${name}, ${label}`}
    >
      <span aria-hidden="true">{CHIP_GLYPH[status]}</span>
      {name}
    </span>
  );
}

export function BoatCard({
  name,
  members,
  me,
}: {
  name: string;
  members: { participantId: string; displayName: string }[];
  me?: string | null;
}) {
  return (
    <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Your boat</p>
      <p className="mt-1 font-display text-2xl font-semibold text-unmute-navy">{name}</p>
      <ul className="mt-3 space-y-1">
        {members.map((m) => (
          <li key={m.participantId} className="font-body text-base text-charcoal">
            {m.displayName}
            {m.participantId === me ? <span className="ml-2 text-slate">(you)</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RulesCard() {
  return (
    <ol className="space-y-3 rounded-lg border border-cloud-grey bg-warm-white p-6">
      {RULES.map((rule, i) => (
        <li key={rule} className="flex gap-3 font-body text-base text-charcoal">
          <span className="font-mono text-sm text-steel-blue">{i + 1}</span>
          <span>{rule}</span>
        </li>
      ))}
    </ol>
  );
}
