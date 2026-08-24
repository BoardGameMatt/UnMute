/**
 * Protocol registry — individual protocols import this and call registerProtocol()
 * from their own index files so the Map is populated at module load time.
 */

import "./placeholder";
import "./the-truth-is";
import "./draw-it-by-ear";
import "./wrong-answers-only";
import "./cover-story";
import "./talk-track";

export {
  getProtocol,
  protocolRegistry,
  registerProtocol,
  type ProtocolDefinition,
  type SessionProtocolProps,
} from "./registry";
