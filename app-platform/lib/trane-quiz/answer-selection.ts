/**
 * Identity of the question on screen. A background poll of the same question
 * must not count as a new question — that was clearing in-progress taps.
 */
export function answerSelectionKey(
  activePhase: "pre" | "post" | null,
  questionId: string | undefined
): string | null {
  if (!questionId) return null;
  return `${activePhase ?? "none"}:${questionId}`;
}
