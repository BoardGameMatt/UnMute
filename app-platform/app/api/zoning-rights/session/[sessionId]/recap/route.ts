import { NextResponse } from "next/server";
import { asAssignment } from "@/lib/protocols/zoning-rights/actions";
import { authorizeZoningRightsParticipant } from "@/lib/protocols/zoning-rights/authorize";
import { exactMatch } from "@/lib/protocols/zoning-rights/engine";
import {
  displayNameMap,
  loadGuesses,
  loadRounds,
  loadRoster,
} from "@/lib/protocols/zoning-rights/store";

type RouteContext = { params: { sessionId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const sessionId = context.params.sessionId;
  const auth = await authorizeZoningRightsParticipant(sessionId, { allowCompleted: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const roster = await loadRoster(auth.admin, sessionId);
  const names = displayNameMap(roster);
  const rounds = await loadRounds(auth.admin, sessionId);

  const individual = rounds.filter((r) => r.mode === "individual" && r.end_reason === "revealed");
  const team = rounds.filter((r) => r.mode === "team" && r.end_reason === "revealed");

  const counts = new Map<string, { guessed: number; exact: number }>();
  for (const person of roster) {
    counts.set(person.participantId, { guessed: 0, exact: 0 });
  }

  for (const round of individual) {
    const guesses = await loadGuesses(auth.admin, round.id);
    for (const guess of guesses) {
      const row = counts.get(guess.participant_id) ?? { guessed: 0, exact: 0 };
      row.guessed += 1;
      if (guess.is_exact) row.exact += 1;
      counts.set(guess.participant_id, row);
    }
  }

  let teamHits = 0;
  for (const round of team) {
    if (exactMatch(asAssignment(round.team_guess_json), asAssignment(round.zm_assignment_json))) {
      teamHits += 1;
    }
  }

  return NextResponse.json({
    entries: roster.map((person) => ({
      participantId: person.participantId,
      displayName: names[person.participantId] ?? "Player",
      exactMatches: counts.get(person.participantId)?.exact ?? 0,
    })),
    teamHits,
    teamRounds: team.length,
  });
}
