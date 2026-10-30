import type { LobbyParticipant } from "@/lib/types/lobby";

/** Supabase may return nested FK as object or single-element array depending on typing. */
function nestedDisplayName(participants: unknown): string | null {
  if (participants == null) return null;
  if (Array.isArray(participants)) {
    const first = participants[0];
    if (first && typeof first === "object" && "display_name" in first) {
      return (first as { display_name: string | null }).display_name;
    }
    return null;
  }
  if (typeof participants === "object" && "display_name" in participants) {
    return (participants as { display_name: string | null }).display_name;
  }
  return null;
}

type RawRow = {
  id: string;
  role_in_session: string;
  participant_id: string;
  participants: unknown;
};

export function mapSessionParticipantRows(
  rows: RawRow[] | null | undefined
): LobbyParticipant[] {
  if (!rows?.length) return [];
  const mapped: LobbyParticipant[] = [];
  for (const r of rows) {
    const displayName = nestedDisplayName(r.participants);
    if (displayName == null) continue;
    mapped.push({
      sessionParticipantId: r.id,
      participantId: r.participant_id,
      displayName,
      roleInSession: r.role_in_session === "lead" ? "lead" : "member",
    });
  }
  return mapped.sort((a, b) => {
    if (a.roleInSession === "lead" && b.roleInSession !== "lead") return -1;
    if (a.roleInSession !== "lead" && b.roleInSession === "lead") return 1;
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });
  });
}
