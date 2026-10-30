import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterByContentPackId } from "./session-pack";

describe("filterByContentPackId", () => {
  const packA = "pack-a";
  const packB = "pack-b";
  const rows = [
    { id: "q1", content_pack_id: packA },
    { id: "q2", content_pack_id: packA },
    { id: "q3", content_pack_id: packB },
  ];

  it("returns only rows for the session pack", () => {
    const filtered = filterByContentPackId(rows, packA);
    assert.deepEqual(
      filtered.map((r) => r.id),
      ["q1", "q2"]
    );
  });

  it("excludes another pack entirely (Pack A session cannot see Pack B)", () => {
    const filtered = filterByContentPackId(rows, packA);
    assert.equal(
      filtered.some((r) => r.content_pack_id === packB),
      false
    );
  });

  it("returns empty when nothing matches", () => {
    assert.deepEqual(filterByContentPackId(rows, "missing"), []);
  });
});
