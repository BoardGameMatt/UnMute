export function formatRevealDate(isoDate: string | null): string {
  if (!isoDate) return "the reveal date";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Last calendar day that may be logged as a plant (strictly before reveal). */
export function lastPlantDate(isoDate: string | null): string | undefined {
  if (!isoDate) return undefined;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const prior = new Date(Date.UTC(year, month - 1, day - 1));
  return prior.toISOString().slice(0, 10);
}
