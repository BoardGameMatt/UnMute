import ZoningRightsProtocol from "./ZoningRightsProtocol";
import { ZoningRightsLobbyExplainer } from "./components/ZoningRightsLobbyExplainer";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "zoning-rights",
  name: "Zoning Rights",
  description: "Predict how a colleague would place buildings on a growing city map.",
  type: "turnbased",
  minPlayers: 3,
  maxPlayers: 20,
  component: ZoningRightsProtocol,
  lobbyExplainer: ZoningRightsLobbyExplainer,
});
