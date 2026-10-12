import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blindTurns,
  buildHighlightCard,
  dangerChoices,
  enablers,
  firstSurfaceTurns,
  lostDivers,
  trend,
  type MetricBoat,
} from "./metrics";
import type { StoredAirtimeEvent } from "./types";

const choice = (
  dive: number,
  turn: number,
  pid: string,
  boat: string,
  c: "deeper" | "up",
  margin: number,
  crew: boolean
): StoredAirtimeEvent => ({
  dive,
  type: "choice",
  turn,
  payload: {
    participant_id: pid,
    boat_id: boat,
    choice: c,
    timed_out: false,
    depth_before: 1,
    depth_after: c === "deeper" ? 2 : 0,
    margin_at_choice: margin,
    crew_present: crew,
  },
});

const surfaced = (dive: number, turn: number, pid: string, boat: string, haul: number): StoredAirtimeEvent => ({
  dive,
  type: "surfaced",
  turn,
  payload: { participant_id: pid, boat_id: boat, haul },
});

const BOATS: MetricBoat[] = [
  { boatId: "A", name: "Calypso", memberIds: ["ana", "bo", "cy"] },
  { boatId: "B", name: "Nautilus", memberIds: ["dee", "eli", "fay"] },
];

const NAMES = new Map([
  ["ana", "Ana"],
  ["bo", "Bo"],
  ["cy", "Cy"],
  ["dee", "Dee"],
  ["eli", "Eli"],
  ["fay", "Fay"],
]);

const DIVE_1: StoredAirtimeEvent[] = [
  choice(1, 1, "ana", "A", "deeper", 5, false),
  choice(1, 1, "dee", "B", "deeper", 5, false),
  choice(1, 4, "dee", "B", "deeper", -2, true),
  choice(1, 4, "eli", "B", "deeper", -2, true),
  choice(1, 5, "eli", "B", "deeper", -3, false),
  surfaced(1, 4, "fay", "B", 1),
  surfaced(1, 5, "bo", "A", 3),
  surfaced(1, 6, "ana", "A", 20),
  { dive: 1, type: "out_of_air", turn: 7, payload: { boat_id: "B", lost_participant_ids: ["dee", "eli"], lost_hauls: [8, 12] } },
  surfaced(1, 7, "cy", "A", 1),
  { dive: 1, type: "dive_end", turn: 8, payload: { end_reason: "all_back" } },
];

describe("metrics", () => {
  it("first to surface per boat", () => {
    const firsts = firstSurfaceTurns(DIVE_1, 1);
    assert.equal(firsts.get("A"), 5);
    assert.equal(firsts.get("B"), 4);
  });

  it("blind turns count boat-turns with divers down and no crew", () => {
    assert.equal(blindTurns(DIVE_1, 1), 3);
  });

  it("danger choices with crew present", () => {
    assert.deepEqual(dangerChoices(DIVE_1, 1), { total: 3, withCrew: 2 });
  });

  it("lost divers", () => {
    assert.deepEqual(lostDivers(DIVE_1, 1), ["dee", "eli"]);
  });

  it("enablers are low hauls on above-average boats", () => {
    const list = enablers(DIVE_1, 1, BOATS, null);
    assert.deepEqual(list.map((e) => e.participantId), ["cy"]);
  });

  it("trend rows per dive", () => {
    const rows = trend(DIVE_1, BOATS);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.boats.find((b) => b.boatId === "A"), {
      boatId: "A",
      total: 24,
      firstSurfaceTurn: 5,
      lost: 0,
    });
  });

  it("highlight card without names", () => {
    const [line] = buildHighlightCard({ events: DIVE_1, boats: BOATS, rival: null, names: NAMES, showNames: false });
    assert.equal(
      line,
      "Dive 1: no boat had crew on the surface until turn 4. Divers chose Dive Deeper 3 times while their boat's air couldn't bring everyone back, 2 of those with crew on the surface. 2 divers lost their treasure. The winning boat scored 24, with 1 diver bringing up 1 point each."
    );
  });

  it("highlight card with names", () => {
    const [line] = buildHighlightCard({ events: DIVE_1, boats: BOATS, rival: null, names: NAMES, showNames: true });
    assert.ok(line?.endsWith("with Cy bringing up 1 point each."));
  });

  it("The Orca counts toward the average and can win a dive", () => {
    const solo: MetricBoat[] = [{ boatId: "A", name: "Calypso", memberIds: ["ana", "bo"] }];
    const events: StoredAirtimeEvent[] = [
      surfaced(1, 1, "bo", "A", 1),
      surfaced(1, 3, "ana", "A", 4),
      { dive: 1, type: "dive_end", turn: 3, payload: { end_reason: "all_back" } },
    ];
    const [line] = buildHighlightCard({
      events,
      boats: solo,
      rival: { name: "The Orca", diveScore: 8 },
      names: NAMES,
      showNames: false,
    });
    assert.ok(line?.includes("first crew surfaced on turn 1."));
    assert.ok(line?.endsWith("The winning boat scored 8."));
    assert.deepEqual(enablers(events, 1, solo, { name: "The Orca", diveScore: 8 }), []);
  });
});
