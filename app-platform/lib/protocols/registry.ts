import type { ComponentType } from "react";
import type { Json, ProtocolType, SessionParticipantRole } from "@/lib/types/database";

/** Props passed to every registered protocol shell component. */
export interface SessionProtocolProps {
  sessionId: string;
  participantId: string;
  role: SessionParticipantRole;
  teamId: string;
}

/**
 * Runtime protocol module metadata + UI entry.
 * Each protocol self-registers from its index via registerProtocol().
 */
export interface ProtocolDefinition {
  slug: string;
  name: string;
  description: string;
  type: ProtocolType;
  minPlayers: number;
  maxPlayers: number;
  component: ComponentType<SessionProtocolProps>;
  /**
   * Optional lobby teaching slot. Rendered below the join QR and above the
   * participant roster. Protocols that omit this leave the lobby unchanged.
   */
  lobbyExplainer?: ComponentType;
  /** Optional JSON-schema-shaped or app-specific config metadata */
  configSchema?: Json;
}

export const protocolRegistry = new Map<string, ProtocolDefinition>();

export function registerProtocol(definition: ProtocolDefinition): void {
  protocolRegistry.set(definition.slug, definition);
}

export function getProtocol(slug: string): ProtocolDefinition | undefined {
  return protocolRegistry.get(slug);
}
