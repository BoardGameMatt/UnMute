import type { ComponentType } from "react";
import type { Json, ProtocolType } from "@/lib/types/database";

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
  component: ComponentType<object>;
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
