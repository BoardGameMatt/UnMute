/**
 * Airtime bot crew: N simulated players join a lobby you host, play every turn
 * through the same endpoints a phone uses, talk inside their boat by the game's
 * rules, huddle between dives, and log anything a person would find odd.
 *
 *   npm run bots:airtime -- --code DNEMB8 [--count 12] [--base https://app.unmutelabs.com] [--poll-ms 1500]
 *
 * You host and facilitate on the Shared screen as usual. Bots stop after you
 * press Continue, submit a 1–10 rating with a comment, and the run writes a
 * report to bot-reports/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { AIRTIME_CONFIG } from "../lib/protocols/airtime/config";
import type { AirtimePlayState, Choice, GaugeBand } from "../lib/protocols/airtime/types";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

// ---------------------------------------------------------------------------
// Args

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? String(process.argv[i + 1]) : fallback;
}

const CODE = arg("code", "").toUpperCase();
const COUNT = Math.max(1, Math.min(15, Number(arg("count", "12"))));
const BASE = arg("base", "https://app.unmutelabs.com").replace(/\/$/, "");
const POLL_MS = Math.max(500, Number(arg("poll-ms", "1500")));
const COOKIE = "unmute_participant_id";
const TURN_MS = AIRTIME_CONFIG.turnSeconds * 1000;
const GRACE_MS = AIRTIME_CONFIG.lateChoiceGraceSeconds * 1000;
const BEAT_MS = AIRTIME_CONFIG.resultBeatSeconds * 1000;

if (!CODE) {
  console.error("Usage: npm run bots:airtime -- --code ABC123 [--count 12]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Utilities

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const chance = (p: number) => Math.random() < p;
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;
const clock = () => new Date().toISOString().slice(11, 19);

function shuffle<T>(xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Personas

type PersonaKind = "focused" | "cautious" | "teamPlayer" | "erratic" | "distracted" | "stubborn";

type Persona = {
  kind: PersonaKind;
  blurb: string;
  /** Depth a naive dive-1 player aims for. */
  naiveDepth: () => number;
  /** Gauge bands that make this diver turn around. */
  turnAroundBands: GaugeBand[];
  /** Chance a crew warning makes them swim up. */
  trust: number;
  /** Chance they speak up as crew when the margin goes bad. */
  speakUp: number;
  /** Delay after the window opens before tapping (ms). Null = no tap this turn. */
  tapDelay: () => number | null;
  /** Chance they follow the boat plan after a huddle. */
  followsPlan: number;
  /** Chance per turn of a random choice. */
  noise: number;
};

const PERSONAS: Record<PersonaKind, Persona> = {
  focused: {
    kind: "focused",
    blurb: "Goal-driven. Wants the best treasure; reads 'bring up as much as you can' as personal.",
    naiveDepth: () => pick([5, 6, 6]),
    turnAroundBands: ["critical"],
    trust: 0.45,
    speakUp: 0.5,
    tapDelay: () => rand(1500, 6000),
    followsPlan: 0.75,
    noise: 0.03,
  },
  cautious: {
    kind: "cautious",
    blurb: "Risk-averse. Turns back early and listens to warnings.",
    naiveDepth: () => pick([2, 3, 3]),
    turnAroundBands: ["low", "critical"],
    trust: 0.9,
    speakUp: 0.7,
    tapDelay: () => rand(3000, 11000),
    followsPlan: 0.9,
    noise: 0.02,
  },
  teamPlayer: {
    kind: "teamPlayer",
    blurb: "Watches the group, volunteers for unglamorous jobs, talks a lot as crew.",
    naiveDepth: () => pick([3, 4]),
    turnAroundBands: ["low", "critical"],
    trust: 0.85,
    speakUp: 0.95,
    tapDelay: () => rand(2000, 8000),
    followsPlan: 0.95,
    noise: 0.02,
  },
  erratic: {
    kind: "erratic",
    blurb: "Unpredictable. Random taps, double taps, changes plans on a whim.",
    naiveDepth: () => pick([1, 2, 4, 6]),
    turnAroundBands: chance(0.5) ? ["critical"] : ["half", "low", "critical"],
    trust: 0.4,
    speakUp: 0.35,
    tapDelay: () => (chance(0.1) ? null : rand(300, 20500)),
    followsPlan: 0.5,
    noise: 0.3,
  },
  distracted: {
    kind: "distracted",
    blurb: "Multitasking. Taps late, misses turns, phone locks once.",
    naiveDepth: () => pick([3, 4, 5]),
    turnAroundBands: ["low", "critical"],
    trust: 0.6,
    speakUp: 0.3,
    tapDelay: () => (chance(0.2) ? null : rand(15000, 21700)),
    followsPlan: 0.7,
    noise: 0.05,
  },
  stubborn: {
    kind: "stubborn",
    blurb: "Confident, ignores advice, slow to change strategy.",
    naiveDepth: () => 6,
    turnAroundBands: ["critical"],
    trust: 0.15,
    speakUp: 0.4,
    tapDelay: () => rand(1000, 5000),
    followsPlan: 0.4,
    noise: 0.03,
  },
};

const PERSONA_MIX: PersonaKind[] = [
  "focused", "focused", "focused", "cautious", "cautious", "teamPlayer",
  "teamPlayer", "erratic", "erratic", "distracted", "distracted", "stubborn",
  "focused", "cautious", "erratic",
];

const NAMES = [
  "Priya", "Marcus", "Dana", "Theo", "Aisha", "Ben", "Carmen", "Jules", "Kenji", "Leah",
  "Omar", "Rosa", "Sam", "Tasha", "Victor", "Wren", "Yusuf", "Zoe", "Hugo", "Nina",
];

// ---------------------------------------------------------------------------
// Logs

type Severity = "info" | "warn" | "error";

type Anomaly = {
  at: string;
  bot: string;
  persona: PersonaKind;
  phase: string;
  dive: number;
  turn: number;
  severity: Severity;
  kind: string;
  detail: string;
  /** How a person in the session would describe it. */
  humanNote: string;
};

type JournalLine = { at: string; bot: string; text: string };

const anomalies: Anomaly[] = [];
const journal: JournalLine[] = [];
const huddles: { boat: string; afterDive: number; lines: string[] }[] = [];
const latencies: number[] = [];
const feedbacks: { bot: string; persona: PersonaKind; rating: number; comment: string }[] = [];
let requestCount = 0;
let errorCount = 0;

// ---------------------------------------------------------------------------
// Boat channel (in-dive talk follows the game's rules)

type Warning = { dive: number; turn: number; from: string; to: string[]; kind: "comeUp" | "keepGoing"; text: string };
const boatTalk = new Map<string, Warning[]>();

function say(boatId: string, w: Warning) {
  const list = boatTalk.get(boatId) ?? [];
  list.push(w);
  boatTalk.set(boatId, list);
}

function heard(boatId: string, dive: number, turn: number, me: string): Warning[] {
  return (boatTalk.get(boatId) ?? []).filter(
    (w) => w.dive === dive && w.turn >= turn - 1 && (w.to.length === 0 || w.to.includes(me))
  );
}

// ---------------------------------------------------------------------------
// Bot

type Plan = { targetDepth: number; crewEarly: boolean; warnAtMargin: number };

type DiveObs = {
  dive: number;
  boatId: string;
  status: string;
  haul: number;
  deepest: number;
  surfacedTurn: number | null;
  warnedComeUp: boolean;
  ignoredWarning: boolean;
  wasCrew: boolean;
  spoke: boolean;
};

class Bot {
  readonly name: string;
  readonly persona: Persona;
  participantId = "";
  sessionId = "";
  state: AirtimePlayState | null = null;
  done = false;
  plan: Plan;
  offsetMs = 0;
  private lastPhase = "";
  private lastDive = 0;
  private lastTurn = 0;
  private lastTurnChangeAt = Date.now();
  private stallFlagged = "";
  private pendingTurn = "";
  private sentTurns = new Set<string>();
  private choiceLog = new Map<string, { choice: Choice | null; depthBefore: number }>();
  private lastTank: { dive: number; tank: number } | null = null;
  private spokeTurns = new Set<string>();
  private observed = new Set<number>();
  private ascending = false;
  private offlineUntil = 0;
  private wentOffline = false;
  obs: DiveObs[] = [];
  private current: Partial<DiveObs> = {};

  constructor(name: string, persona: Persona) {
    this.name = name;
    this.persona = persona;
    this.plan = { targetDepth: persona.naiveDepth(), crewEarly: false, warnAtMargin: -1 };
  }

  private note(text: string) {
    journal.push({ at: new Date().toISOString(), bot: this.name, text });
  }

  flag(severity: Severity, kind: string, detail: string, humanNote: string) {
    const s = this.state;
    anomalies.push({
      at: new Date().toISOString(),
      bot: this.name,
      persona: this.persona.kind,
      phase: s?.phase ?? "lobby",
      dive: s?.diveNumber ?? 0,
      turn: s?.turn ?? 0,
      severity,
      kind,
      detail,
      humanNote,
    });
    const tag = severity === "error" ? "!!" : severity === "warn" ? "! " : "  ";
    console.log(`${clock()} ${tag} ${this.name.padEnd(7)} ${kind}: ${detail}`);
  }

  private serverNow(): number {
    return Date.now() + this.offsetMs;
  }

  private async http(path: string, init?: RequestInit): Promise<{ status: number; body: unknown; ms: number } | null> {
    const t0 = Date.now();
    requestCount++;
    try {
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        redirect: "manual",
        headers: { ...(init?.headers ?? {}), cookie: `${COOKIE}=${this.participantId}` },
      });
      const ms = Date.now() - t0;
      latencies.push(ms);
      if (ms > 8000) this.flag("error", "very-slow-response", `${path} took ${ms}ms`, "The app hung for several seconds.");
      else if (ms > 3000) this.flag("warn", "slow-response", `${path} took ${ms}ms`, "The app felt laggy.");
      let body: unknown = null;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text.slice(0, 200);
      }
      if (res.status >= 500) {
        errorCount++;
        this.flag("error", "server-error", `${init?.method ?? "GET"} ${path} → ${res.status} ${JSON.stringify(body).slice(0, 160)}`, "I got an error message from the app.");
      }
      return { status: res.status, body, ms };
    } catch (err) {
      errorCount++;
      this.flag("error", "network-error", `${path}: ${err instanceof Error ? err.message : String(err)}`, "The app couldn't connect.");
      return null;
    }
  }

  async join(sessionId: string, teamId: string): Promise<boolean> {
    this.sessionId = sessionId;
    const form = new FormData();
    form.set("sessionId", sessionId);
    form.set("teamId", teamId);
    form.set("displayName", this.name);
    const res = await fetch(`${BASE}/api/join/${CODE}`, { method: "POST", body: form, redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    const pid = /pid=([0-9a-f-]{36})/i.exec(location)?.[1];
    if (!pid) {
      const err = decodeURIComponent(/error=([^&]+)/.exec(location)?.[1] ?? `HTTP ${res.status}`).replace(/\+/g, " ");
      this.flag("error", "join-failed", err, `I couldn't join: "${err}"`);
      return false;
    }
    this.participantId = pid;
    await this.http(`/api/session/${sessionId}/claim-participant?pid=${pid}`);
    this.note(`Joined as a ${this.persona.kind} player.`);
    return true;
  }

  async run(): Promise<void> {
    while (!this.done) {
      if (Date.now() < this.offlineUntil) {
        await sleep(500);
        continue;
      }
      await this.poll();
      await this.act();
      await sleep(rand(POLL_MS * 0.7, POLL_MS * 1.3));
    }
  }

  private async poll(): Promise<void> {
    const t0 = Date.now();
    const res = await this.http(`/api/airtime/session/${this.sessionId}/play`);
    if (!res) return;
    if (res.status === 403) {
      await this.finish();
      return;
    }
    if (res.status !== 200) {
      if (res.status !== 500) {
        this.flag("warn", "play-load-failed", `GET play → ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`, "My screen showed an error instead of the game.");
      }
      return;
    }
    const body = res.body as { state?: AirtimePlayState | null };
    const next = body.state ?? null;
    if (!next) return;
    this.offsetMs = new Date(next.serverNow).getTime() - (t0 + res.ms / 2);
    this.inspect(next);
    this.state = next;
  }

  // ---- anomaly checks on every payload ------------------------------------

  private inspect(s: AirtimePlayState) {
    const order = ["lobby", "boats", "rules", "dive_active", "dive_results", "final"];
    const prev = this.state;

    if (prev) {
      const back =
        s.diveNumber < prev.diveNumber ||
        (s.diveNumber === prev.diveNumber && s.phase === prev.phase && s.phase === "dive_active" && s.turn < prev.turn) ||
        (s.diveNumber === prev.diveNumber && order.indexOf(s.phase) < order.indexOf(prev.phase) && !(prev.phase === "dive_results" && s.phase === "dive_active"));
      if (back) {
        this.flag("error", "state-went-backwards", `${prev.phase} d${prev.diveNumber} t${prev.turn} → ${s.phase} d${s.diveNumber} t${s.turn}`, "The screen jumped back to an earlier step.");
      }
    }

    if (s.phase !== this.lastPhase) {
      if (s.phase === "boats") {
        const mine = s.boats.find((b) => b.id === s.myBoatId);
        this.note(`I'm on ${mine?.name ?? "no boat"} with ${mine?.members.filter((m) => m.participantId !== this.participantId).map((m) => m.displayName).join(", ") || "nobody"}.`);
      }
      this.lastPhase = s.phase;
    }

    if (prev?.myBoatId && s.myBoatId && prev.myBoatId !== s.myBoatId) {
      const name = s.boats.find((b) => b.id === s.myBoatId)?.name ?? "another boat";
      if (s.phase === "boats") this.note(`The facilitator moved me to ${name}.`);
      else this.flag("error", "boat-changed-mid-game", `Boat changed during ${s.phase}`, `I was moved to ${name} in the middle of the game.`);
    }

    if (s.phase === "boats" || s.phase === "dive_active") {
      const all = s.boats.flatMap((b) => b.members.map((m) => m.participantId));
      if (new Set(all).size !== all.length) this.flag("error", "player-on-two-boats", "Someone appears on two boats.", "I saw the same person listed on two boats.");
      for (const b of s.boats) {
        if (b.members.length > AIRTIME_CONFIG.maxBoatSize) this.flag("error", "boat-over-capacity", `${b.name} has ${b.members.length}`, `${b.name} had more than four people.`);
      }
      if (s.myBoatId && !s.boats.find((b) => b.id === s.myBoatId)?.members.some((m) => m.participantId === this.participantId)) {
        this.flag("error", "not-on-my-boat", "My boat's member list doesn't include me.", "My own boat didn't list my name.");
      }
    }

    if (s.phase === "dive_active") {
      if (s.diveNumber !== this.lastDive || s.turn !== this.lastTurn) {
        this.lastDive = s.diveNumber;
        this.lastTurn = s.turn;
        this.lastTurnChangeAt = Date.now();
      } else {
        const limit = TURN_MS + GRACE_MS + BEAT_MS + 10000;
        const key = `${s.diveNumber}:${s.turn}`;
        if (Date.now() - this.lastTurnChangeAt > limit && this.stallFlagged !== key) {
          this.stallFlagged = key;
          this.flag("error", "turn-stalled", `Turn ${s.turn} of dive ${s.diveNumber} hasn't advanced in ${Math.round((Date.now() - this.lastTurnChangeAt) / 1000)}s`, "The game froze mid-dive.");
        }
      }
      if (s.results || s.final) this.flag("error", "results-during-dive", "Results or final scores present during a dive.", "I could see scores while we were still diving.");
    }

    if (s.diver) {
      const d = s.diver;
      if (d.status === "underwater" && d.item.value !== null) {
        this.flag("error", "secret-item-value", `Saw my own item value (${d.item.value}) while underwater.`, "I could see what my treasure was worth before surfacing.");
      }
      if (d.status === "underwater" && s.crew) {
        this.flag("error", "secret-crew-view", "Received the exact tank while underwater.", "I could see the exact air numbers while diving.");
      }
      const segs: Record<GaugeBand, number> = { plenty: 4, half: 3, low: 2, critical: 1 };
      if (segs[d.gauge.band] !== d.gauge.segments) {
        this.flag("warn", "gauge-mismatch", `Band ${d.gauge.band} with ${d.gauge.segments} segments`, `The air gauge said "${d.gauge.label}" but the bubbles didn't match.`);
      }
      const key = `${s.diveNumber}:${s.turn - 1}`;
      const prior = this.choiceLog.get(key);
      if (prior && this.lastTurnCheck !== key && d.status === "underwater") {
        this.lastTurnCheck = key;
        const expect = prior.choice === "deeper" ? prior.depthBefore + 1 : prior.depthBefore - 1;
        if (d.depth !== expect) {
          this.flag("error", "depth-mismatch", `Chose ${prior.choice ?? "nothing (timeout→up)"} at depth ${prior.depthBefore}, now at ${d.depth}`, "I ended up at a depth I didn't choose.");
        }
      }
    }

    if (s.crew) {
      const c = s.crew;
      const myBoat = s.boats.find((b) => b.id === s.myBoatId);
      const ids = new Set(myBoat?.members.map((m) => m.participantId) ?? []);
      if (c.rows.some((r) => !ids.has(r.participantId))) {
        this.flag("error", "secret-other-boat", "Crew view lists someone from another boat.", "I could see divers from another boat.");
      }
      if (c.margin !== c.tank - c.airNeeded) {
        this.flag("warn", "margin-math", `tank ${c.tank} − needed ${c.airNeeded} ≠ margin ${c.margin}`, "The crew numbers didn't add up.");
      }
      if (this.lastTank && this.lastTank.dive === s.diveNumber && c.tank > this.lastTank.tank) {
        this.flag("error", "tank-went-up", `Tank rose ${this.lastTank.tank} → ${c.tank} mid-dive`, "The oxygen tank refilled in the middle of a dive.");
      }
      this.lastTank = { dive: s.diveNumber, tank: c.tank };
    }

    if (s.phase === "dive_results" && s.results) {
      const mine = s.results.hauls.find((h) => h.participantId === this.participantId);
      if (s.myBoatId && !mine) this.flag("error", "missing-my-haul", "My haul isn't on the results list.", "My name wasn't on the dive results.");
      if (mine && s.myResult && mine.value !== s.myResult.value) {
        this.flag("error", "haul-mismatch", `Results say ${mine.value}, my screen said ${s.myResult.value}`, "My treasure value changed between screens.");
      }
    }

    if (s.phase === "final" && s.final) {
      for (const row of s.final.standings) {
        const sum = row.diveTotals.reduce((a, b) => a + b, 0);
        if (sum !== row.total) this.flag("error", "final-sum", `${row.name}: dives ${row.diveTotals.join("+")} = ${sum}, total ${row.total}`, "The final score didn't add up across dives.");
        if (row.diveTotals.length !== s.diveNumber) this.flag("warn", "final-dive-count", `${row.name} shows ${row.diveTotals.length} dives, game had ${s.diveNumber}`, "The final screen showed the wrong number of dives.");
      }
      const best = Math.max(...s.final.standings.map((r) => r.total));
      if (s.final.standings.some((r) => r.isWinner && r.total !== best)) {
        this.flag("error", "wrong-winner", "A non-top boat is marked as winner.", "The wrong boat was declared the winner.");
      }
    }
  }

  private lastTurnCheck = "";

  // ---- behavior -----------------------------------------------------------

  private async act(): Promise<void> {
    const s = this.state;
    if (!s) return;

    if (s.phase === "dive_active") this.recordDive(s);
    if (s.phase === "dive_results" && !this.observed.has(s.diveNumber)) {
      this.observed.add(s.diveNumber);
      this.closeDive(s);
      onDiveObserved(this, s.diveNumber);
    }

    if (s.phase !== "dive_active") {
      this.ascending = false;
      return;
    }

    if (
      this.persona.kind === "distracted" &&
      !this.wentOffline &&
      s.diveNumber >= 2 &&
      s.turn >= 3 &&
      chance(0.3)
    ) {
      this.wentOffline = true;
      this.offlineUntil = Date.now() + rand(20000, 40000);
      this.note(`My phone locked on dive ${s.diveNumber}, turn ${s.turn}. Back in a bit.`);
      this.flag("info", "went-offline", "Simulated phone lock for 20–40s.", "My phone locked mid-dive.");
      return;
    }

    if (s.viewerRole === "crew" && s.crew && s.myBoatId) this.crewTalk(s);
    if (s.viewerRole === "diver" && s.diver?.status === "underwater") await this.maybeChoose(s);
  }

  private crewTalk(s: AirtimePlayState) {
    const c = s.crew;
    if (!c || !s.myBoatId) return;
    const key = `${s.diveNumber}:${s.turn}`;
    if (this.spokeTurns.has(key)) return;
    this.spokeTurns.add(key);
    this.current.wasCrew = true;
    const under = c.rows.filter((r) => r.status === "underwater");
    if (under.length === 0) return;
    if (c.margin <= this.plan.warnAtMargin && chance(this.persona.speakUp)) {
      const deepest = [...under].sort((a, b) => b.depth - a.depth).slice(0, c.margin < -3 ? under.length : 1);
      const names = deepest.map((r) => r.displayName).join(" and ");
      say(s.myBoatId, {
        dive: s.diveNumber,
        turn: s.turn,
        from: this.name,
        to: deepest.map((r) => r.participantId),
        kind: "comeUp",
        text: `${names}, come up now! Margin is ${c.margin}.`,
      });
      this.current.spoke = true;
      this.note(`(crew) Told ${names} to come up — margin ${c.margin}.`);
    } else if (c.margin > 4 && chance(this.persona.speakUp * 0.3)) {
      say(s.myBoatId, { dive: s.diveNumber, turn: s.turn, from: this.name, to: [], kind: "keepGoing", text: "Plenty of air, keep going." });
      this.current.spoke = true;
    } else if (c.margin <= this.plan.warnAtMargin) {
      this.note(`(crew) Saw margin ${c.margin} on turn ${s.turn} and said nothing.`);
    }
  }

  private decide(s: AirtimePlayState): Choice {
    const d = s.diver;
    if (!d) return "up";
    if (!d.canDeeper) return "up";
    if (chance(this.persona.noise)) return chance(0.5) ? "deeper" : "up";
    if (this.plan.crewEarly) return "up";
    const warnings = s.myBoatId ? heard(s.myBoatId, s.diveNumber, s.turn, this.participantId) : [];
    const comeUp = warnings.find((w) => w.kind === "comeUp");
    if (comeUp) {
      this.current.warnedComeUp = true;
      if (chance(this.persona.trust)) {
        if (!this.ascending) this.note(`Heard "${comeUp.text}" from ${comeUp.from}. Heading up.`);
        this.ascending = true;
        return "up";
      }
      this.current.ignoredWarning = true;
      this.note(`Heard ${comeUp.from}'s warning and kept going anyway.`);
    }
    if (this.ascending) return this.persona.kind === "erratic" && chance(0.1) ? "deeper" : "up";
    if (this.persona.turnAroundBands.includes(d.gauge.band) || d.depth >= this.plan.targetDepth) {
      this.ascending = true;
      return "up";
    }
    if (warnings.some((w) => w.kind === "keepGoing") && chance(0.5)) return "deeper";
    return "deeper";
  }

  private async maybeChoose(s: AirtimePlayState) {
    const d = s.diver;
    if (!d || d.chosen || !s.windowOpensAt) return;
    const key = `${s.diveNumber}:${s.turn}`;
    if (this.sentTurns.has(key)) {
      return;
    }
    const opensAt = new Date(s.windowOpensAt).getTime();
    if (this.pendingTurn !== key) {
      this.pendingTurn = key;
      const delay = this.persona.tapDelay();
      this.tapAt = delay === null ? null : opensAt + delay;
      if (delay === null) {
        this.choiceLog.set(key, { choice: null, depthBefore: d.depth });
        this.note(`Didn't tap on dive ${s.diveNumber}, turn ${s.turn} (looked away).`);
      }
    }
    if (this.tapAt === null) return;
    const now = this.serverNow();
    if (now < this.tapAt) {
      const wait = this.tapAt - now;
      if (wait < POLL_MS * 1.3) await sleep(wait);
      else return;
    }
    const closesAt = opensAt + TURN_MS;
    if (this.serverNow() > closesAt) return;

    const choice = this.decide(s);
    this.sentTurns.add(key);
    this.choiceLog.set(key, { choice, depthBefore: d.depth });
    const msLeft = closesAt - this.serverNow();
    const res = await this.http(`/api/airtime/session/${this.sessionId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "choose", choice, turn: s.turn }),
    });
    if (!res) return;
    if (res.status !== 200) {
      const msg = JSON.stringify(res.body);
      const sev: Severity = msLeft > 1500 ? "error" : "warn";
      this.flag(sev, "tap-rejected", `${choice} on turn ${s.turn} with ${Math.round(msLeft / 100) / 10}s left → ${res.status} ${msg.slice(0, 120)}`, `I tapped ${choice === "up" ? "Swim back up" : "Dive Deeper"} in time and it was refused.`);
      this.choiceLog.set(key, { choice: null, depthBefore: d.depth });
      return;
    }
    const after = (res.body as { state?: AirtimePlayState | null }).state;
    if (after && after.turn === s.turn && after.diveNumber === s.diveNumber && after.diver && after.diver.chosen !== choice) {
      this.flag("warn", "tap-not-shown", `Sent ${choice}, screen shows ${after.diver.chosen ?? "nothing"}`, "I tapped but the button didn't lock in.");
    }
    if (this.persona.kind === "erratic" && chance(0.15)) {
      const again = await this.http(`/api/airtime/session/${this.sessionId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "choose", choice: choice === "up" ? "deeper" : "up", turn: s.turn }),
      });
      if (again && again.status >= 500) this.flag("error", "double-tap-error", "Second tap errored.", "Tapping twice broke something.");
    }
  }

  private tapAt: number | null = null;

  private recordDive(s: AirtimePlayState) {
    if (this.current.dive !== s.diveNumber) {
      this.current = { dive: s.diveNumber, boatId: s.myBoatId ?? "", warnedComeUp: false, ignoredWarning: false, wasCrew: false, spoke: false };
      this.lastTank = null;
    }
    if (s.diver) this.current.deepest = Math.max(this.current.deepest ?? 0, s.diver.deepest);
  }

  private closeDive(s: AirtimePlayState) {
    const mine = s.results?.hauls.find((h) => h.participantId === this.participantId);
    const o: DiveObs = {
      dive: s.diveNumber,
      boatId: s.myBoatId ?? this.current.boatId ?? "",
      status: mine?.status ?? "unknown",
      haul: mine?.value ?? 0,
      deepest: this.current.deepest ?? 0,
      surfacedTurn: null,
      warnedComeUp: this.current.warnedComeUp ?? false,
      ignoredWarning: this.current.ignoredWarning ?? false,
      wasCrew: this.current.wasCrew ?? false,
      spoke: this.current.spoke ?? false,
    };
    this.obs.push(o);
    const verdict =
      o.status === "lost"
        ? `Lost my ${mine?.itemName ?? "treasure"} when the air ran out.`
        : o.status === "forfeit"
          ? "The dive ended while I was still down. Got nothing."
          : `Brought up ${mine?.itemName ?? "something"} worth ${o.haul}.`;
    this.note(`Dive ${s.diveNumber}: ${verdict}`);
  }

  private async finish() {
    if (this.done) return;
    this.done = true;
    const mine = anomalies.filter((a) => a.bot === this.name && a.severity !== "info");
    const lost = this.obs.filter((o) => o.status === "lost").length;
    let rating = Math.round(rand(6, 9.5)) - Math.min(4, mine.length) - (lost > 1 ? 1 : 0);
    if (this.persona.kind === "erratic") rating = Math.round(rand(3, 10));
    rating = Math.max(1, Math.min(10, rating));
    const flavor: Record<PersonaKind, string> = {
      focused: "Wanted more treasure. Not sure the scoring was clear until the end.",
      cautious: "Liked being able to come up early and help.",
      teamPlayer: "Fun once our boat started talking between dives.",
      erratic: pick(["lol chaos", "fun!!", "kind of confusing", "loved the submarine"]),
      distracted: "Missed a few turns, the timer moves fast.",
      stubborn: "I'd have done fine if the air lasted longer.",
    };
    const issue = mine[0] ? ` Also: ${mine[0].humanNote}` : "";
    const comment = `${flavor[this.persona.kind]}${issue}`.slice(0, 480);
    const res = await this.http(`/api/session/${this.sessionId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    if (res && res.status !== 200 && res.status !== 201) {
      this.flag("warn", "feedback-failed", `POST feedback → ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`, "The rating screen wouldn't take my answer.");
    }
    feedbacks.push({ bot: this.name, persona: this.persona.kind, rating, comment });
    this.note(`Rated the session ${rating}/10.`);
  }
}

// ---------------------------------------------------------------------------
// Between-dive huddles

const bots: Bot[] = [];
const huddled = new Set<string>();

function onDiveObserved(_bot: Bot, dive: number) {
  const byBoat = new Map<string, Bot[]>();
  for (const b of bots) {
    const boatId = b.obs.find((o) => o.dive === dive)?.boatId || b.state?.myBoatId;
    if (boatId) byBoat.set(boatId, [...(byBoat.get(boatId) ?? []), b]);
  }
  for (const [boatId, crew] of byBoat) {
    const key = `${boatId}:${dive}`;
    if (huddled.has(key)) continue;
    if (!crew.every((b) => b.obs.some((o) => o.dive === dive))) continue;
    huddled.add(key);
    huddle(boatId, crew, dive);
  }
}

function huddle(boatId: string, crew: Bot[], dive: number) {
  const boatName = crew[0]?.state?.boats.find((b) => b.id === boatId)?.name ?? "Boat";
  const obs = crew.map((b) => ({ b, o: b.obs.find((x) => x.dive === dive) as DiveObs }));
  const lost = obs.filter(({ o }) => o.status === "lost" || o.status === "forfeit");
  const total = obs.reduce((a, { o }) => a + o.haul, 0);
  const anyCrewSpoke = obs.some(({ o }) => o.spoke);
  const ignored = obs.filter(({ o }) => o.ignoredWarning);
  const lines: string[] = [];
  const speaker = () => pick(crew).name;

  lines.push(`${speaker()}: Okay, we brought up ${total} between us.`);
  if (lost.length > 0) {
    lines.push(`${lost.map(({ b }) => b.name).join(" and ")}: We lost our treasure — the tank ran dry while we were down.`);
    if (!anyCrewSpoke) lines.push(`${speaker()}: Nobody up top said anything. Someone needs to come up early and watch the numbers.`);
    if (ignored.length > 0) lines.push(`${ignored[0]?.b.name}: I heard the warning, I just didn't think it was that bad.`);
  } else {
    lines.push(`${speaker()}: Nobody drowned. Could we go deeper?`);
  }

  const volunteerOrder: PersonaKind[] = ["teamPlayer", "cautious", "distracted", "focused", "erratic", "stubborn"];
  const volunteer = [...crew].sort((a, b) => volunteerOrder.indexOf(a.persona.kind) - volunteerOrder.indexOf(b.persona.kind))[0];
  const deepDiver = [...crew].sort((a, b) => volunteerOrder.indexOf(b.persona.kind) - volunteerOrder.indexOf(a.persona.kind))[0];

  for (const b of crew) {
    const follows = chance(b.persona.followsPlan);
    const next: Plan = { ...b.plan };
    if (lost.length > 0 && crew.length > 1) {
      if (b === volunteer) {
        next.crewEarly = true;
        next.warnAtMargin = 2;
      } else if (b === deepDiver) {
        next.targetDepth = 6;
        next.crewEarly = false;
      } else {
        next.targetDepth = Math.max(2, Math.min(b.plan.targetDepth - 1, 3));
        next.crewEarly = false;
      }
      next.warnAtMargin = Math.max(next.warnAtMargin, 1);
    } else if (lost.length === 0) {
      next.targetDepth = Math.min(6, b.plan.targetDepth + 1);
    }
    if (b.persona.kind === "erratic" && chance(0.4)) next.targetDepth = pick([1, 3, 5, 6]);
    if (follows) b.plan = next;
    else lines.push(`${b.name}: Eh, I'm doing my own thing.`);
  }
  if (lost.length > 0 && crew.length > 1 && volunteer && deepDiver) {
    lines.push(`${volunteer.name}: I'll come straight up and be crew. I'll call it when the air gets tight.`);
    if (deepDiver !== volunteer) lines.push(`${deepDiver.name}: Then I'll go for the deep stuff.`);
  }
  huddles.push({ boat: boatName, afterDive: dive, lines });
  console.log(`${clock()}    huddle  ${boatName} after dive ${dive}: ${lines.length} lines`);
}

// ---------------------------------------------------------------------------
// Report

function pct(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

function writeReport(startedAt: Date, sessionId: string) {
  const dir = resolve(process.cwd(), "bot-reports");
  mkdirSync(dir, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = join(dir, `airtime-${CODE}-${stamp}`);
  const real = anomalies.filter((a) => a.severity !== "info");
  const groups = new Map<string, Anomaly[]>();
  for (const a of real) groups.set(`${a.severity}|${a.kind}`, [...(groups.get(`${a.severity}|${a.kind}`) ?? []), a]);

  const md: string[] = [];
  md.push(`# Airtime bot run — ${CODE}`, "");
  md.push(`- Started: ${startedAt.toISOString()}`, `- Ended: ${new Date().toISOString()}`, `- Target: ${BASE}`, `- Session: ${sessionId}`, `- Bots: ${bots.length}`);
  md.push(`- Requests: ${requestCount}, failed: ${errorCount}`, `- Latency p50 ${pct(latencies, 50)}ms · p95 ${pct(latencies, 95)}ms · max ${Math.max(0, ...latencies)}ms`, "");
  md.push("## Verdict", "");
  md.push(real.some((a) => a.severity === "error") ? "**Problems found.** See below." : real.length ? "**Minor issues only.**" : "**Clean run.** No player saw anything out of the ordinary.", "");
  md.push("## What players noticed", "");
  if (groups.size === 0) md.push("Nothing.", "");
  for (const [k, list] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const [sev, kind] = k.split("|");
    md.push(`### ${sev === "error" ? "Error" : "Warning"}: ${kind} (${list.length}×, ${new Set(list.map((a) => a.bot)).size} players)`);
    md.push(`> "${list[0]?.humanNote}"`, "");
    for (const a of list.slice(0, 8)) md.push(`- ${a.at.slice(11, 19)} ${a.bot} (${a.persona}) · ${a.phase} dive ${a.dive} turn ${a.turn} — ${a.detail}`);
    if (list.length > 8) md.push(`- …and ${list.length - 8} more`);
    md.push("");
  }
  md.push("## Players", "", "| Bot | Persona | Rating | Comment |", "|---|---|---|---|");
  for (const b of bots) {
    const f = feedbacks.find((x) => x.bot === b.name);
    md.push(`| ${b.name} | ${b.persona.kind} | ${f?.rating ?? "—"} | ${f?.comment.replace(/\|/g, "/") ?? "(didn't finish)"} |`);
  }
  md.push("", "## Boat huddles", "");
  for (const h of huddles) {
    md.push(`### ${h.boat}, after dive ${h.afterDive}`, ...h.lines.map((l) => `- ${l}`), "");
  }
  md.push("## Journals", "");
  for (const b of bots) {
    md.push(`### ${b.name} (${b.persona.kind}) — ${b.persona.blurb}`);
    for (const j of journal.filter((x) => x.bot === b.name)) md.push(`- ${j.at.slice(11, 19)} ${j.text}`);
    md.push("");
  }
  writeFileSync(`${base}.md`, md.join("\n"));
  writeFileSync(`${base}.json`, JSON.stringify({ code: CODE, sessionId, base: BASE, anomalies, journal, huddles, feedbacks, latencies }, null, 2));
  return `${base}.md`;
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: session } = await admin
    .from("sessions")
    .select("id, team_id, status, protocols ( slug )")
    .eq("join_code", CODE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) throw new Error(`No session with join code ${CODE}.`);
  if (session.status !== "lobby") throw new Error(`Session ${CODE} is ${session.status}; bots can only join a lobby.`);

  const { data: roster } = await admin
    .from("session_participants")
    .select("participants ( display_name )")
    .eq("session_id", session.id);
  const taken = new Set(
    (roster ?? []).map((r) => {
      const p = r.participants as { display_name?: string } | { display_name?: string }[] | null;
      return (Array.isArray(p) ? p[0]?.display_name : p?.display_name)?.toLowerCase() ?? "";
    })
  );
  const names = shuffle(NAMES.filter((n) => !taken.has(n.toLowerCase())));
  const mix = shuffle(PERSONA_MIX.slice(0, COUNT));

  const startedAt = new Date();
  console.log(`${clock()}    ${COUNT} bots joining ${CODE} on ${BASE}`);
  for (let i = 0; i < COUNT; i++) {
    const persona = PERSONAS[mix[i] ?? "focused"];
    const bot = new Bot(names[i] ?? `Player${i + 1}`, persona);
    const ok = await bot.join(session.id, session.team_id as string);
    if (ok) {
      bots.push(bot);
      console.log(`${clock()}    joined  ${bot.name.padEnd(7)} ${persona.kind}`);
    }
    await sleep(rand(300, 1500));
  }
  console.log(`${clock()}    ${bots.length} bots in the lobby. Start the session on the Shared screen when ready.`);

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const b of bots) b.done = true;
  };
  process.on("SIGINT", stop);

  await Promise.all(bots.map((b) => b.run()));
  const path = writeReport(startedAt, session.id);
  const errs = anomalies.filter((a) => a.severity === "error").length;
  const warns = anomalies.filter((a) => a.severity === "warn").length;
  console.log(`\n${clock()}    Done. ${errs} errors, ${warns} warnings. Report: ${path}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
