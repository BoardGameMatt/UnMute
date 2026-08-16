export type BriefingPanel = {
  song: string;
  body: string;
};

/** Locked Oasis teaching copy. Song titles appear as ordinary words. */
export const BRIEFING_PANELS: BriefingPanel[] = [
  {
    song: "Little by Little",
    body: "When people know they can rely on one another, the workday changes. You spend less energy protecting yourself and more on the actual problem. Little by little, colleagues ask for help sooner and treat mistakes as information. The result is not just a warmer room. It is a team that keeps moving when the plan gets messy.",
  },
  {
    song: "The Masterplan",
    body: "A busy team without a shared picture of success will still produce motion. It will also pull in five directions. The masterplan does not have to live on a slide. It has to show up in ordinary conversation: what we are optimizing for, what we will not do, and who owns the next step. When that picture is held in common, individual effort stops canceling itself out.",
  },
  {
    song: "Don't Look Back in Anger",
    body: "When a deadline moves or a launch misses, don't look back in anger. Name what happened, skip the referendum on competence, and renegotiate in the open. Teams that can do this are not being soft. They are keeping the work alive through contact with the real week.",
  },
  {
    song: "Live Forever",
    body: "Job satisfaction tracks a simple question: when I get stuck, will anyone stay in it long enough that I can finish well? People who have that experience grow faster. They also stay. The best teams build work that can live forever in the practices they leave behind.",
  },
  {
    song: "Wonderwall",
    body: "None of this holds if the only record of success is a fading thread in chat. Teams need a place to mark what they pulled off together, a wonderwall of the work worth remembering, however informal. Names, dates, the ugly version before it worked. That memory is how a group becomes a culture instead of a calendar of meetings.",
  },
];

export function highlightSongTitle(body: string, song: string): {
  before: string;
  title: string;
  after: string;
} | null {
  const index = body.toLowerCase().indexOf(song.toLowerCase());
  if (index < 0) return null;
  return {
    before: body.slice(0, index),
    title: body.slice(index, index + song.length),
    after: body.slice(index + song.length),
  };
}
