type RosterPerson = {
  participantId: string;
  displayName: string;
  isLead: boolean;
};

type CoverStoryTapNameRosterProps = {
  sessionId: string;
  people: RosterPerson[];
};

export function CoverStoryTapNameRoster({
  sessionId,
  people,
}: CoverStoryTapNameRosterProps) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="space-y-2 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
          Cover Story
        </p>
        <h1 className="font-display text-3xl font-bold text-unmute-navy">
          Tap your name
        </h1>
        <p className="font-body text-lg text-slate">
          Rejoin this session. If your name is missing, ask the facilitator to
          admit you. The facilitator uses their private host link.
        </p>
      </div>
      <ul className="flex w-full flex-col gap-3">
        {people
          .filter((person) => !person.isLead)
          .map((person) => (
          <li key={person.participantId}>
            <a
              href={`/api/session/${sessionId}/claim-participant?pid=${person.participantId}`}
              className="flex items-center justify-between rounded-lg border border-cloud-grey bg-warm-white px-4 py-3 font-display font-semibold text-unmute-navy shadow-sm transition hover:bg-cloud-grey"
            >
              <span>{person.displayName}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
