import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SAY_LESS_DECK_SIZE,
  SAY_LESS_MAX_TURNS_BEFORE_PAUSE,
  applyPileOutcome,
  cardForViewer,
  cardsPerTurn,
  dealPreviews,
  drawDeck,
  expireSimOnce,
  expireSimUntilHold,
  canPassInRound,
  isFacilitatorHold,
  pickClueGiver,
  sessionProgress,
  shouldPauseAfterTurns,
  splitTeams,
  swapPlayers,
  teamScores,
  winnerLabel,
  type SayLessCategoryId,
  type SayLessSimGame,
} from "./engine";

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i}`);

describe("splitTeams", () => {
  it("4 → 2 / 2", () => {
    const teams = splitTeams(ids(4), () => 0.5);
    assert.equal(teams.A.length, 2);
    assert.equal(teams.B.length, 2);
  });

  it("5 → Team A gets the extra person", () => {
    const teams = splitTeams(ids(5), () => 0.3);
    assert.equal(teams.A.length, 3);
    assert.equal(teams.B.length, 2);
  });

  it("13 → 7 / 6", () => {
    const teams = splitTeams(ids(13), () => 0.2);
    assert.equal(teams.A.length, 7);
    assert.equal(teams.B.length, 6);
  });

  it("14 → 7 / 7 and covers everyone once", () => {
    const people = ids(14);
    const teams = splitTeams(people, () => 0.8);
    assert.equal(teams.A.length, 7);
    assert.equal(teams.B.length, 7);
    const all = [...teams.A, ...teams.B];
    assert.equal(all.length, 14);
    assert.equal(new Set(all).size, 14);
  });

  it("rejects fewer than 4 and more than 14", () => {
    assert.throws(() => splitTeams(ids(3)), /at least 4/);
    assert.throws(() => splitTeams(ids(15)), /caps at 14/);
  });
});

describe("swapPlayers", () => {
  it("switches two people, each taking the other's place", () => {
    const result = swapPlayers({ A: ["a", "b", "c"], B: ["d", "e"] }, "b", "e");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.teams.A, ["a", "e", "c"]);
    assert.deepEqual(result.teams.B, ["d", "b"]);
  });

  it("works in either tap order", () => {
    const result = swapPlayers({ A: ["a", "b"], B: ["c", "d"] }, "d", "a");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.teams.A, ["d", "b"]);
    assert.deepEqual(result.teams.B, ["c", "a"]);
  });

  it("refuses two people on the same team", () => {
    const result = swapPlayers({ A: ["a", "b"], B: ["c", "d"] }, "a", "b");
    assert.equal(result.ok, false);
  });
});

describe("teamScores", () => {
  const turns = [
    { id: "t1", round: 1 as const, team_id: "ta" },
    { id: "t2", round: 1 as const, team_id: "tb" },
    { id: "t3", round: 2 as const, team_id: "ta" },
  ];
  const events = [
    { turn_id: "t1", outcome: "got_it" as const },
    { turn_id: "t1", outcome: "got_it" as const },
    { turn_id: "t2", outcome: "got_it" as const },
    { turn_id: "t2", outcome: "expired" as const },
    { turn_id: "t3", outcome: "got_it" as const },
    { turn_id: "t3", outcome: "pass" as const },
  ];

  it("counts whole cards guessed per team, per round", () => {
    assert.deepEqual(teamScores(turns, events, { A: "ta", B: "tb" }, 1), { A: 2, B: 1 });
  });

  it("totals across both rounds", () => {
    const total = teamScores(turns, events, { A: "ta", B: "tb" });
    assert.deepEqual(total, { A: 3, B: 1 });
    assert.equal(winnerLabel(total), "A");
    assert.equal(winnerLabel({ A: 4, B: 4 }), null);
  });
});

describe("round 1 pass rule", () => {
  it("blocks Pass / Oops in round 1 only", () => {
    assert.equal(canPassInRound(1), false);
    assert.equal(canPassInRound(2), true);
  });
});

describe("drawDeck", () => {
  const catalog = (category: SayLessCategoryId, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${category}-${i}`,
      category,
      active: true,
    }));

  it("draws 10 from each chosen category and shuffles to 20", () => {
    const cards = [
      ...catalog("automotive-fleet", 15),
      ...catalog("movie-people", 15),
      ...catalog("musicians", 15),
    ];
    const deck = drawDeck(cards, "automotive-fleet", "movie-people", () => 0.1);
    assert.equal(deck.length, SAY_LESS_DECK_SIZE);
    const auto = deck.filter((id) => id.startsWith("automotive-fleet-"));
    const movies = deck.filter((id) => id.startsWith("movie-people-"));
    assert.equal(auto.length, 10);
    assert.equal(movies.length, 10);
    assert.equal(deck.some((id) => id.startsWith("musicians-")), false);
  });
});

describe("dealPreviews", () => {
  const deck = Array.from({ length: 20 }, (_, i) => `c${i}`);

  it("gives each player two distinct cards", () => {
    const dealt = dealPreviews(deck, ids(4), () => 0.4);
    for (const pair of Object.values(dealt)) {
      assert.equal(pair.length, 2);
      assert.notEqual(pair[0], pair[1]);
    }
  });

  it("covers every card once at 10 players", () => {
    const dealt = dealPreviews(deck, ids(10), () => 0.2);
    const seen = Object.values(dealt).flat();
    assert.equal(seen.length, 20);
    assert.equal(new Set(seen).size, 20);
  });

  it("spreads duplicates when there are more than 10 players", () => {
    const dealt = dealPreviews(deck, ids(11), () => 0.6);
    const counts = new Map<string, number>();
    for (const id of Object.values(dealt).flat()) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const twice = Array.from(counts.values()).filter((n) => n === 2);
    assert.equal(twice.length, 2);
  });
});

describe("applyPileOutcome", () => {
  it("Got it removes the top card", () => {
    assert.deepEqual(applyPileOutcome(["a", "b", "c"], "got_it"), ["b", "c"]);
  });

  it("Pass, Oops, and expired send the card to the bottom", () => {
    assert.deepEqual(applyPileOutcome(["a", "b", "c"], "pass"), ["b", "c", "a"]);
    assert.deepEqual(applyPileOutcome(["a", "b", "c"], "oops"), ["b", "c", "a"]);
    assert.deepEqual(applyPileOutcome(["a", "b", "c"], "expired"), ["b", "c", "a"]);
  });
});

describe("pickClueGiver", () => {
  it("starts at the cursor and advances past them", () => {
    const pick = pickClueGiver(["a", "b", "c"], 1, {});
    assert.equal(pick.giverId, "b");
    assert.equal(pick.nextCursor, 2);
  });

  it("skips a disconnected teammate and consumes their slot", () => {
    const pick = pickClueGiver(["a", "b", "c"], 0, { a: false, b: true, c: true });
    assert.equal(pick.giverId, "b");
    assert.equal(pick.nextCursor, 2);
  });

  it("returns null when nobody on the team is connected", () => {
    const pick = pickClueGiver(["a", "b"], 0, { a: false, b: false, x: true });
    assert.equal(pick.giverId, null);
  });
});

describe("scoring helpers", () => {
  it("cards per turn treats a short last turn as a full turn", () => {
    assert.equal(cardsPerTurn(20, 5), 4);
    assert.equal(cardsPerTurn(3, 0), null);
  });

  it("pauses HOLD on the 10th counted turn, not the 11th", () => {
    assert.equal(shouldPauseAfterTurns(9), false);
    assert.equal(shouldPauseAfterTurns(10), true);
    assert.equal(shouldPauseAfterTurns(11), true);
  });

  it("progress is got-it over 40, or 20 for a round ended early", () => {
    assert.equal(
      sessionProgress({
        round1GotIt: 10,
        round2GotIt: 0,
        round1EndedEarly: false,
        round2EndedEarly: false,
        phase: "round_break",
      }),
      0.25
    );
    assert.equal(
      sessionProgress({
        round1GotIt: 8,
        round2GotIt: 0,
        round1EndedEarly: true,
        round2EndedEarly: false,
        phase: "round_break",
      }),
      0.5
    );
    assert.equal(
      sessionProgress({
        round1GotIt: 8,
        round2GotIt: 5,
        round1EndedEarly: true,
        round2EndedEarly: true,
        phase: "final_scores",
      }),
      1
    );
  });

  it("strips the card unless the viewer is the clue-giver", () => {
    assert.deepEqual(cardForViewer("a", "a", { name: "Jeep" }), { name: "Jeep" });
    assert.equal(cardForViewer("b", "a", { name: "Jeep" }), null);
  });
});

describe("liveness", () => {
  const base = (): SayLessSimGame => ({
    phase: "preview",
    paused: false,
    deadlineMs: 1_000,
    pile: ["c1", "c2"],
    nextTeam: "A",
    teams: {
      A: { members: ["a1", "a2"], cursor: 0 },
      B: { members: ["b1", "b2"], cursor: 0 },
    },
    connected: { a1: true, a2: true, b1: true, b2: true },
    countedTurns: 0,
    round: 1,
  });

  it("preview deadline reaches the READY facilitator hold", () => {
    const next = expireSimUntilHold(base(), 1_000);
    assert.equal(next.phase, "ready");
    assert.equal(isFacilitatorHold(next.phase, next.paused), true);
  });

  it("a turn deadline goes to HOLD, then the next turn", () => {
    const turn: SayLessSimGame = { ...base(), phase: "turn", deadlineMs: 1_000 };
    const hold = expireSimOnce(turn, 1_000);
    assert.equal(hold.phase, "hold");
    const next = expireSimOnce(hold, hold.deadlineMs ?? 1_000);
    assert.equal(next.phase, "turn");
  });

  it("ten empty turns pause HOLD so the Lead can end the round", () => {
    let game: SayLessSimGame = { ...base(), phase: "turn", deadlineMs: 1_000 };
    for (let i = 0; i < SAY_LESS_MAX_TURNS_BEFORE_PAUSE; i++) {
      game = expireSimUntilHold(game, 1_000 + i * 60_000);
      if (i < SAY_LESS_MAX_TURNS_BEFORE_PAUSE - 1 && game.phase === "hold" && !game.paused) {
        game = { ...game, phase: "turn", deadlineMs: 1_000 + (i + 1) * 60_000 };
      }
    }
    assert.equal(game.phase, "hold");
    assert.equal(game.paused, true);
    assert.equal(isFacilitatorHold(game.phase, game.paused), true);
  });
});
