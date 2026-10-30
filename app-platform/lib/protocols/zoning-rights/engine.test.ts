import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignmentComplete,
  assignmentForViewer,
  consumedBuildingIds,
  drawOpeningCross,
  emptyBoard,
  exactMatch,
  isLegalLot,
  legalLots,
  letterLots,
  livePoolIds,
  moveAssignment,
  pickExclusiveRole,
  pickRotatingRole,
  placeBuildingsOnLots,
  timerHasExpired,
} from "./engine";
import { cellKey } from "./engine";
import { HALL_COL, HALL_ROW, OPENING_CROSS } from "./types";
import { ZONING_RIGHTS_PACK_A_NAMES } from "./pack-a-names";

function openingBoard() {
  const ids = ["n", "e", "s", "w"];
  const { board } = drawOpeningCross(ids, () => 0);
  return board;
}

describe("legalLots", () => {
  it("opening cross yields the eight spec lots", () => {
    const board = openingBoard();
    const lots = legalLots(board);
    const keys = lots.map((c) => cellKey(c.col, c.row)).sort();
    assert.deepEqual(keys, [
      "0,3",
      "1,2",
      "1,4",
      "2,1",
      "2,5",
      "3,2",
      "3,4",
      "4,3",
    ]);
    assert.equal(lots.length, 8);
  });

  it("grows after round-1 buildings lock onto three opening lots", () => {
    const board = openingBoard();
    const placed = placeBuildingsOnLots(
      board,
      [
        { letter: "A", col: 2, row: 1 },
        { letter: "B", col: 4, row: 3 },
        { letter: "C", col: 2, row: 5 },
      ],
      { A: "b1", B: "b2", C: "b3" }
    );
    const lots = legalLots(placed);
    assert.ok(lots.length > 8);
    assert.ok(lots.some((c) => c.col === 2 && c.row === 0));
    assert.ok(lots.some((c) => c.col === 4 && c.row === 2));
    assert.ok(!isLegalLot(placed, 2, 1));
    assert.ok(!isLegalLot(placed, HALL_COL, HALL_ROW));
  });

  it("rejects diagonal-only adjacency", () => {
    const board = emptyBoard();
    assert.equal(isLegalLot(board, 1, 2), false);
    assert.equal(isLegalLot(board, HALL_COL, HALL_ROW - 1), true);
  });
});

describe("letterLots", () => {
  it("assigns A B C top-to-bottom then left-to-right, not tap order", () => {
    const lots = letterLots([
      { col: 4, row: 3 },
      { col: 2, row: 1 },
      { col: 0, row: 3 },
    ]);
    assert.deepEqual(
      lots.map((l) => `${l.letter}:${l.col},${l.row}`),
      ["A:2,1", "B:0,3", "C:4,3"]
    );
  });
});

describe("exactMatch", () => {
  it("requires every letter", () => {
    assert.equal(exactMatch({ A: "1", B: "2", C: "3" }, { A: "1", B: "2", C: "3" }), true);
    assert.equal(exactMatch({ A: "1", B: "2", C: "3" }, { A: "1", B: "3", C: "2" }), false);
    assert.equal(exactMatch({ A: "1", B: "2" }, { A: "1", B: "2", C: "3" }), false);
    assert.equal(exactMatch(null, { A: "1" }), false);
  });

  it("assignmentComplete needs all k letters", () => {
    assert.equal(assignmentComplete({ A: "1", B: "2", C: "3" }, 3), true);
    assert.equal(assignmentComplete({ A: "1", B: "2" }, 3), false);
    assert.equal(assignmentComplete({ A: "1", B: "2", C: "3", D: "4" }, 4), true);
  });

  it("moveAssignment swaps when the letter is occupied", () => {
    const next = moveAssignment({ A: "1", B: "2" }, "1", "B");
    assert.equal(next.A, "2");
    assert.equal(next.B, "1");
  });
});

describe("pickRotatingRole", () => {
  it("never returns the excluded id", () => {
    const pick = pickRotatingRole(["p1", "p2", "p3"], "p1", [], () => 0);
    assert.notEqual(pick, "p1");
  });

  it("prefers people who have not had the role yet", () => {
    const pick = pickRotatingRole(["p1", "p2", "p3"], "p1", ["p2"], () => 0);
    assert.equal(pick, "p3");
  });
});

describe("pickExclusiveRole", () => {
  it("never returns planner or zoning manager", () => {
    const pick = pickExclusiveRole(["p1", "p2", "p3"], ["p1", "p2"], [], () => 0);
    assert.equal(pick, "p3");
  });
});

describe("livePoolIds", () => {
  it("keeps everyone when nobody is marked connected", () => {
    assert.deepEqual(
      livePoolIds([
        { id: "a", connected: false },
        { id: "b", connected: false },
      ]),
      ["a", "b"]
    );
  });

  it("drops disconnected members when someone is live", () => {
    assert.deepEqual(
      livePoolIds([
        { id: "a", connected: true },
        { id: "b", connected: false },
        { id: "c", connected: true },
      ]),
      ["a", "c"]
    );
  });
});

describe("assignmentForViewer", () => {
  const assignment = { A: "x" };
  it("strips for non-ZM before reveal", () => {
    assert.equal(assignmentForViewer("g1", "zm", false, assignment), null);
  });
  it("returns for ZM before reveal", () => {
    assert.deepEqual(assignmentForViewer("zm", "zm", false, assignment), assignment);
  });
  it("returns after reveal", () => {
    assert.deepEqual(assignmentForViewer("g1", "zm", true, assignment), assignment);
  });
});

describe("drawOpeningCross", () => {
  it("occupies hall plus four cardinals and consumes four ids", () => {
    const { board, consumedIds } = drawOpeningCross(["a", "b", "c", "d", "e"], () => 0);
    assert.equal(consumedIds.length, 4);
    assert.equal(board.occupants[cellKey(HALL_COL, HALL_ROW)]?.kind, "hall");
    for (const spot of OPENING_CROSS) {
      const occ = board.occupants[cellKey(spot.col, spot.row)];
      assert.equal(occ?.kind, "building");
    }
    assert.equal(consumedBuildingIds(board).length, 4);
  });
});

describe("timerHasExpired", () => {
  it("expires after duration", () => {
    const start = new Date(1_000_000).toISOString();
    assert.equal(timerHasExpired(start, 1_000_000 + 59_000, 60), false);
    assert.equal(timerHasExpired(start, 1_000_000 + 60_000, 60), true);
  });
});

describe("Pack A", () => {
  it("has 121 unique names", () => {
    assert.equal(ZONING_RIGHTS_PACK_A_NAMES.length, 121);
    assert.equal(new Set(ZONING_RIGHTS_PACK_A_NAMES).size, 121);
  });
});
