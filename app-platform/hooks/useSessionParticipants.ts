"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapSessionParticipantRows } from "@/lib/session/map-lobby-participants";
import type { LobbyParticipant } from "@/lib/types/lobby";

async function fetchParticipants(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<LobbyParticipant[]> {
  const { data, error } = await supabase
    .from("session_participants")
    .select(
      "id, role_in_session, participant_id, participants ( display_name )"
    )
    .eq("session_id", sessionId);

  if (error) {
    console.error("fetchParticipants", error.message);
    return [];
  }
  return mapSessionParticipantRows(
    data as Parameters<typeof mapSessionParticipantRows>[0]
  );
}

/**
 * Subscribes to inserts on `session_participants` for this session and keeps
 * the participant list in sync without a full page reload.
 */
export function useSessionParticipants(
  sessionId: string,
  initialParticipants: LobbyParticipant[]
): LobbyParticipant[] {
  const supabase = useMemo(() => createClient(), []);
  const [participants, setParticipants] =
    useState<LobbyParticipant[]>(initialParticipants);

  useEffect(() => {
    setParticipants(initialParticipants);
  }, [initialParticipants]);

  useEffect(() => {
    const channel = supabase
      .channel(`session_participants:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          const next = await fetchParticipants(supabase, sessionId);
          setParticipants(next);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, supabase]);

  return participants;
}
