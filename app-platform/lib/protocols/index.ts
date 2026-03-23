/**
 * Protocol registry and base protocol interface.
 */

export interface BaseProtocol {
  id: string;
  name: string;
  version: string;
}

// Registry placeholder — extend as needed
export const protocolRegistry: Record<string, BaseProtocol> = {};
