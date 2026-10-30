import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerSelectionKey } from "./answer-selection";

describe("answerSelectionKey", () => {
  it("stays the same when a refresh is still on the same question", () => {
    assert.equal(
      answerSelectionKey("pre", "q1"),
      answerSelectionKey("pre", "q1")
    );
  });

  it("changes when the question or the quiz pass changes", () => {
    assert.notEqual(
      answerSelectionKey("pre", "q1"),
      answerSelectionKey("pre", "q2")
    );
    assert.notEqual(
      answerSelectionKey("pre", "q1"),
      answerSelectionKey("post", "q1")
    );
  });

  it("is empty when there is no question on screen", () => {
    assert.equal(answerSelectionKey("pre", undefined), null);
    assert.equal(answerSelectionKey(null, undefined), null);
  });
});
