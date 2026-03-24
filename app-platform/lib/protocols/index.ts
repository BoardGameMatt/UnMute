/**
 * Protocol registry — individual protocols import this and call registerProtocol()
 * from their own index files so the Map is populated at module load time.
 */

export {
  getProtocol,
  protocolRegistry,
  registerProtocol,
  type ProtocolDefinition,
} from "./registry";
