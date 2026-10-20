import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OTSP } from "./config";
import {
  createGame,
  displayLap,
  drawPlacers,
  majorityReached,
  mulberry32,
  orderTurns,
  pickImproviser,
  pickPicture,
  projectPlayState,
  reduceFor,
  roundSeed,
  scoreRound,
} from "./engine";
import { PACK_A } from "./pictures";
import type { OtspGame } from "./types";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `p${index + 1}`);

function started(count: number, seed = 1, now = 1_000): OtspGame {
  return createGame({
    seed,
    playerIds: ids(count),
    debtIds: [],
    usedPictureIds: [],
    catalog: PACK_A,
    now,
  }).game;
}

function must<T extends { ok: true }>(result: T | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("picture library", () => {
  it("has 50 pictures, 10 per family, and the 16-item starter pool", () => {
    assert.equal(PACK_A.length, 50);
    for (const family of ["round", "peaked", "long", "boxy", "distinct"]) {
      assert.equal(PACK_A.filter((picture) => picture.family === family).length, 10);
    }
    const starters = PACK_A.filter((picture) => picture.starter).map((picture) => picture.label).sort();
    assert.deepEqual(starters, [
      "Apple",
      "Candle",
      "Car",
      "Chair",
      "Fish",
      "Flower",
      "Guitar",
      "Hourglass",
      "Key",
      "Ladybug",
      "Mug",
      "Rocket",
      "Sailboat",
      "Submarine",
      "Teapot",
      "Top hat",
    ]);
    assert.equal(PACK_A.some((picture) => picture.label === "Rubber duck"), false);
  });
});

describe("draw and order", () => {
  it("fills from carry, then other undrawn players, then people who already placed", () => {
    const rng = mulberry32(4);
    const drawn = drawPlacers(["a", "b", "c", "d", "e", "f", "g", "h"], ["a", "b", "c", "d", "e"], ["f", "h"], rng);
    assert.deepEqual(drawn.slice(0, 2).sort(), ["f", "h"]);
    assert.equal(drawn[2], "g");
    assert.ok(drawn[3] && ["a", "b", "c", "d", "e"].includes(drawn[3]));
    assert.ok(drawn[4] && ["a", "b", "c", "d", "e"].includes(drawn[4]));
  });

  it("never gives the Improviser the first seat", () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const order = orderTurns(["a", "b", "c", "d", "e"], "a", mulberry32(seed));
      assert.notEqual(order[0], "a");
      assert.equal(new Set(order).size, 5);
    }
  });

  it("picks the earliest Improviser when everyone in the five has already been one", () => {
    const picked = pickImproviser(["a", "b", "c", "d", "e"], ["c", "a", "b", "d", "e"], mulberry32(1));
    assert.equal(picked, "c");
  });

  it("keeps round 1 in the starter pool and avoids the previous family", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const first = pickPicture(PACK_A, { roundNumber: 1, usedIds: [], lastFamily: null, rng: mulberry32(seed) });
      assert.equal(first.starter, true);
      const second = pickPicture(PACK_A, {
        roundNumber: 2,
        usedIds: [first.id],
        lastFamily: first.family,
        rng: mulberry32(seed + 9),
      });
      assert.notEqual(second.family, first.family);
      assert.notEqual(second.id, first.id);
    }
  });
});

describe("scoring", () => {
  it("uses the integer majority", () => {
    assert.equal(majorityReached(4, 7), true);
    assert.equal(majorityReached(3, 7), false);
    assert.equal(majorityReached(2, 3), true);
    assert.equal(majorityReached(1, 3), false);
    assert.equal(majorityReached(3, 6), false);
    assert.equal(majorityReached(0, 0), false);
  });

  it("matches the 12-player worked example", () => {
    const game = started(12, 7);
    const builders = game.playerIds.filter((id) => game.round.roles[id] === "builder");
    const inspectors = game.playerIds.filter((id) => game.round.roles[id] === "inspector");
    const improviser = game.round.improviserId;
    assert.equal(builders.length, 4);
    assert.equal(inspectors.length, 7);
    inspectors.slice(0, 3).forEach((id) => {
      game.round.guesses[id] = { itemId: game.round.pictureId, band: 1 };
    });
    const fourth = inspectors[3];
    assert.ok(fourth);
    game.round.guesses[fourth] = { itemId: game.round.pictureId, band: 3 };
    game.round.guesses[improviser] = { itemId: "not-the-picture", band: 1 };
    for (const id of [builders[0], builders[1], inspectors[0], inspectors[1]]) {
      assert.ok(id);
      game.round.pins[id] = improviser;
    }

    const scored = scoreRound(game);
    assert.equal(scored.readPicture, 4 / 7);
    assert.equal(scored.readPerson, 4 / 11);
    assert.equal(scored.points[improviser], 3);
    assert.equal(scored.points[builders[0] as string], 5);
    assert.equal(scored.points[builders[2] as string], 3);
    assert.equal(scored.points[inspectors[0] as string], 7);
    assert.equal(scored.points[fourth], 3);
    assert.equal(scored.points[inspectors[4] as string], 0);
  });

  it("withholds the builder bonus when the Improviser names the picture", () => {
    const game = started(8, 3);
    const builder = game.playerIds.find((id) => game.round.roles[id] === "builder");
    assert.ok(builder);
    for (const id of game.playerIds) {
      if (game.round.roles[id] === "inspector" || id === game.round.improviserId) {
        game.round.guesses[id] = { itemId: game.round.pictureId, band: 2 };
      }
    }
    const scored = scoreRound(game);
    assert.equal(scored.points[builder], 0);
  });
});

describe("round flow", () => {
  it("places on Place, places a tile on an empty timeout, and places a full preview", () => {
    let game = started(8, 2, 5_000);
    game = must(reduceFor(game, { type: "expire", actorId: "p1" }, game.round.phaseEndsAt, PACK_A)).game;
    assert.equal(game.phase, "build");
    const actor = game.round.placers[0] as string;
    game = must(
      reduceFor(game, { type: "place", actorId: actor, tile: "square", row: 0, col: 0 }, game.round.phaseEndsAt - 1000, PACK_A)
    ).game;
    assert.equal(game.round.placements.length, 1);
    assert.equal(game.round.cursor, 1);

    const waiting = game.round.placers[1] as string;
    const timed = must(reduceFor(game, { type: "expire", actorId: waiting }, game.round.phaseEndsAt + OTSP.graceMs, PACK_A));
    assert.equal(timed.events[0]?.type, "place");
    const timedTile = timed.game.round.placements.at(-1);
    assert.ok(timedTile && !timedTile.passed);
    game = timed.game;

    const next = game.round.placers[game.round.cursor % 5] as string;
    game = must(
      reduceFor(game, { type: "preview", actorId: next, tile: "tri_ll", row: 1, col: 1 }, game.round.phaseEndsAt, PACK_A)
    ).game;
    const placed = must(reduceFor(game, { type: "expire", actorId: next }, game.round.phaseEndsAt + OTSP.graceMs, PACK_A));
    assert.equal(placed.events[0]?.type, "place");
    const tile = placed.game.round.placements.at(-1);
    assert.ok(tile && !tile.passed && tile.tile === "tri_ll");
  });

  it("lets a player change a guess, and a later change scores fewer points", () => {
    let game = started(8, 5, 5_000);
    const inspector = game.playerIds.find((id) => game.round.roles[id] === "inspector");
    const builder = game.playerIds.find((id) => game.round.roles[id] === "builder");
    const other = game.round.guessIds.find((id) => id !== game.round.pictureId) as string;
    assert.ok(inspector && builder);
    game = must(reduceFor(game, { type: "guess", actorId: inspector, itemId: game.round.pictureId }, 5_000, PACK_A)).game;
    assert.equal(game.round.guesses[inspector]?.band, 1);
    assert.equal(scoreRound(game).points[inspector], 5);
    game = must(reduceFor(game, { type: "guess", actorId: inspector, itemId: game.round.pictureId }, 5_000, PACK_A)).game;
    assert.equal(game.round.guesses[inspector]?.band, 1);
    game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt, PACK_A)).game;
    for (let turn = 0; turn < 10; turn += 1) {
      game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt + OTSP.graceMs, PACK_A)).game;
    }
    assert.equal(game.phase, "checkin");
    game = must(reduceFor(game, { type: "guess", actorId: inspector, itemId: other }, 5_000, PACK_A)).game;
    assert.equal(scoreRound(game).points[inspector], 0);
    game = must(reduceFor(game, { type: "guess", actorId: inspector, itemId: game.round.pictureId }, 5_000, PACK_A)).game;
    assert.equal(game.round.guesses[inspector]?.band, 2);
    assert.equal(scoreRound(game).points[inspector], 4);
    const denied = reduceFor(game, { type: "guess", actorId: builder, itemId: other }, 5_000, PACK_A);
    assert.equal(denied.ok, false);
  });

  it("finishes laps 1 and 2 and the check-in when the majority lands early", () => {
    let game = started(8, 11, 10_000);
    const inspectors = game.playerIds.filter((id) => game.round.roles[id] === "inspector");
    for (const id of inspectors.slice(0, 2)) {
      game = must(reduceFor(game, { type: "guess", actorId: id, itemId: game.round.pictureId }, 10_000, PACK_A)).game;
    }
    assert.equal(game.round.endAfterCheckin, true);
    game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt, PACK_A)).game;
    assert.equal(game.phase, "build");
    for (let turn = 0; turn < 10; turn += 1) {
      game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt + OTSP.graceMs, PACK_A)).game;
    }
    assert.equal(game.phase, "checkin");
    assert.equal(displayLap(game), 2);
    game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt, PACK_A)).game;
    assert.equal(game.phase, "final_lock");
    assert.equal(game.round.endReason, "early");
  });

  it("ends after the current turn once the majority lands in lap 3", () => {
    let game = started(8, 13, 10_000);
    game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt, PACK_A)).game;
    for (let turn = 0; turn < 10; turn += 1) {
      game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt + OTSP.graceMs, PACK_A)).game;
    }
    assert.equal(game.phase, "checkin");
    game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt, PACK_A)).game;
    assert.equal(game.phase, "build");
    assert.equal(displayLap(game), 3);
    const inspectors = game.playerIds.filter((id) => game.round.roles[id] === "inspector");
    for (const id of inspectors.slice(0, 2)) {
      game = must(reduceFor(game, { type: "guess", actorId: id, itemId: game.round.pictureId }, game.round.phaseEndsAt, PACK_A)).game;
    }
    assert.equal(game.round.endAfterTurn, true);
    const cursor = game.round.cursor;
    game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt + OTSP.graceMs, PACK_A)).game;
    assert.equal(game.phase, "final_lock");
    assert.equal(game.round.cursor, cursor + 1);
    assert.ok(game.round.cursor < 25);
  });
});

describe("visibility", () => {
  it("hides the picture, roles, and guesses from the shared screen and from an Inspector", () => {
    let game = started(8, 4, 8_000);
    game = must(reduceFor(game, { type: "expire", actorId: "x" }, game.round.phaseEndsAt, PACK_A)).game;
    const names = Object.fromEntries(game.playerIds.map((id) => [id, id.toUpperCase()]));
    const inspector = game.playerIds.find((id) => game.round.roles[id] === "inspector") as string;
    const builder = game.playerIds.find((id) => game.round.roles[id] === "builder") as string;
    const screen = projectPlayState(game, { participantId: "screen", isDisplay: true, canControl: true }, names, PACK_A);
    const watching = projectPlayState(game, { participantId: inspector, isDisplay: false, canControl: false }, names, PACK_A);
    const building = projectPlayState(game, { participantId: builder, isDisplay: false, canControl: false }, names, PACK_A);

    assert.equal(screen.pictureLabel, null);
    assert.equal(screen.myRole, null);
    assert.equal(screen.guessList.length, 0);
    assert.equal(screen.placements.every((tile) => tile.color === null), true);
    assert.equal(screen.improviserId, null);
    assert.equal(watching.pictureLabel, null);
    assert.equal(watching.guessList.length, 10);
    assert.equal(building.pictureLabel, PACK_A.find((picture) => picture.id === game.round.pictureId)?.label);
    assert.equal(building.guessList.length, 0);
    assert.equal(watching.improviserId, null);
    assert.equal(screen.guessList.some((item) => item.id === game.round.pictureId), false);
    assert.equal(watching.canPin, true);
    assert.equal(building.canPin, true);
    const improviser = game.round.improviserId;
    const improvising = projectPlayState(game, { participantId: improviser, isDisplay: false, canControl: false }, names, PACK_A);
    assert.equal(improvising.canPin, false);
    const other = game.round.placers.find((id) => id !== improviser) as string;
    const denied = reduceFor(game, { type: "pin", actorId: improviser, targetId: other }, game.round.phaseEndsAt, PACK_A);
    assert.equal(denied.ok, false);
    assert.equal(screen.placers.some((placer) => placer.active), true);
  });
});

describe("seeds", () => {
  it("derives a stable round seed", () => {
    assert.equal(roundSeed(99, 1), roundSeed(99, 1));
    assert.notEqual(roundSeed(99, 1), roundSeed(99, 2));
  });
});
