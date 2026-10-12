/**
 * Airtime tuning simulation (spec §17).
 *
 *   npx tsx scripts/airtime-sim.ts [trials]
 *
 * For boat sizes 2–4, plays every plan (each diver's target depth, then swim
 * back up) with real card draws and the 14-turn cap, and checks:
 *   1. The best plan sends one diver to level 6, the rest shallow, one up early.
 *   2. That plan beats the best everyone-to-the-same-depth plan by ≥ 15%.
 *   3. Everyone diving deep runs the tank dry.
 * Exits 1 if a condition fails.
 */
import { AIRTIME_CONFIG } from "../lib/protocols/airtime/config";
import { newDive, resolveTurn, seededRandom, tankFor } from "../lib/protocols/airtime/engine";
import type { Choice, DiveState } from "../lib/protocols/airtime/types";

const TRIALS = Number(process.argv[2] ?? 2000);
const SIZES = [2, 3, 4];
const MAX = AIRTIME_CONFIG.maxDepth;

type PlanResult = { plan: number[]; mean: number; lostRate: number };

function choicesFor(state: DiveState, targets: Map<string, number>): Record<string, Choice> {
  const out: Record<string, Choice> = {};
  for (const d of state.divers) {
    if (d.status !== "underwater") continue;
    const target = targets.get(d.participantId) ?? 1;
    out[d.participantId] = d.depth === d.deepest && d.deepest < target ? "deeper" : "up";
  }
  return out;
}

function play(plan: number[], seed: string): { score: number; lost: number } {
  const ids = plan.map((_, i) => `d${i}`);
  const targets = new Map(ids.map((id, i) => [id, plan[i] ?? 1]));
  let state = newDive([{ boatId: "b", memberIds: ids }], seededRandom(seed));
  for (;;) {
    const result = resolveTurn(state, choicesFor(state, targets));
    state = result.state;
    if (result.ended) break;
  }
  return {
    score: state.divers.filter((d) => d.status === "surfaced").reduce((s, d) => s + d.haul, 0),
    lost: state.divers.filter((d) => d.status !== "surfaced").length,
  };
}

function evaluate(plan: number[]): PlanResult {
  let total = 0;
  let lost = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = play(plan, `${plan.join("")}-${t}`);
    total += r.score;
    lost += r.lost;
  }
  return { plan, mean: total / TRIALS, lostRate: lost / (TRIALS * plan.length) };
}

/** Non-increasing target lists (order doesn't matter on one boat). */
function plans(size: number, maxTarget = MAX): number[][] {
  if (size === 0) return [[]];
  const out: number[][] = [];
  for (let first = maxTarget; first >= 1; first--) {
    for (const rest of plans(size - 1, first)) out.push([first, ...rest]);
  }
  return out;
}

let failed = false;
const pct = (a: number, b: number) => (b === 0 ? Infinity : ((a - b) / b) * 100);

for (const size of SIZES) {
  const results = plans(size).map(evaluate).sort((a, b) => b.mean - a.mean);
  const best = results[0];
  if (!best) continue;
  const sameDepth = results
    .filter((r) => r.plan.every((d) => d === r.plan[0]))
    .sort((a, b) => b.mean - a.mean)[0];
  const allDeep = results.find((r) => r.plan.every((d) => d === MAX));
  const oneDeep = results.find((r) => r.plan[0] === MAX && r.plan.slice(1).every((d) => d === 1));

  const hasSix = best.plan.includes(MAX);
  const restShallow = best.plan.filter((d) => d !== MAX).every((d) => d <= 4);
  const earlyCrew = best.plan.includes(1) || best.plan.includes(2);
  const c1 = hasSix && restShallow && earlyCrew;
  const gap = sameDepth ? pct(best.mean, sameDepth.mean) : Infinity;
  const c2 = gap >= 15;
  const c3 = (allDeep?.lostRate ?? 0) === 1;

  console.log(`\nBoat of ${size} (tank ${tankFor(size)})`);
  console.log(`  Top plans:`);
  for (const r of results.slice(0, 5)) {
    console.log(`    ${r.plan.join(", ").padEnd(12)} avg ${r.mean.toFixed(1).padStart(5)}  lost ${(r.lostRate * 100).toFixed(0)}%`);
  }
  if (sameDepth) console.log(`  Best same depth: ${sameDepth.plan.join(", ")} avg ${sameDepth.mean.toFixed(1)}`);
  if (oneDeep) console.log(`  One deep, rest up early: ${oneDeep.plan.join(", ")} avg ${oneDeep.mean.toFixed(1)}`);
  if (allDeep) console.log(`  Everyone deep: lost ${(allDeep.lostRate * 100).toFixed(0)}%`);
  console.log(`  1. Best plan shape (one to 6, rest shallow, early crew): ${c1 ? "PASS" : "FAIL"}`);
  console.log(`  2. Beats same depth by ${gap.toFixed(0)}% (need 15%): ${c2 ? "PASS" : "FAIL"}`);
  console.log(`  3. Everyone deep runs dry: ${c3 ? "PASS" : "FAIL"}`);
  if (!c1 || !c2 || !c3) failed = true;
}

console.log(failed ? "\nTuning: FAIL" : "\nTuning: PASS");
process.exit(failed ? 1 : 0);
