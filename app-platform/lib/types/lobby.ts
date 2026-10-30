/** Normalized lobby row for UI + Realtime (matches session_participants + participants join). */
export type LobbyParticipant = {
  sessionParticipantId: string;
  participantId: string;
  displayName: string;
  roleInSession: "lead" | "member";
};
