/**
 * Server-side broadcast onto the per-pair Realtime channel.
 * Uses httpSend so API routes do not need a long-lived WebSocket.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WaoBroadcastPayload } from "./types";
import { waoPairChannelName } from "./types";

export async function broadcastPairEvent(
  admin: SupabaseClient,
  roundId: string,
  pairId: string,
  payload: WaoBroadcastPayload
): Promise<void> {
  const topic = waoPairChannelName(roundId, pairId);
  const channel = admin.channel(topic, {
    config: { broadcast: { ack: false, self: false } },
  });

  try {
    const result = await channel.httpSend(payload.type, payload);
    if (!result.success) {
      console.error(
        `[wao] broadcast failed on ${topic}:`,
        "error" in result ? result.error : "unknown"
      );
    }
  } catch (err) {
    console.error(`[wao] broadcast threw on ${topic}:`, err);
  } finally {
    await admin.removeChannel(channel);
  }
}
