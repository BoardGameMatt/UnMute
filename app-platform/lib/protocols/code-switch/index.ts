import CodeSwitchProtocol from "./CodeSwitchProtocol";
import { CodeSwitchLobbyExplainer } from "./components/CodeSwitchLobbyExplainer";
import { CodeSwitchRoomDisplayPin } from "./components/CodeSwitchRoomDisplayPin";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "code-switch",
  name: "SwitchCode",
  description:
    "Clue givers write one secret word. Assemble or Disperse filters what the guesser sees. The team scores only if they type it.",
  type: "realtime",
  minPlayers: 4,
  maxPlayers: 20,
  component: CodeSwitchProtocol,
  lobbyExplainer: CodeSwitchLobbyExplainer,
  lobbyLeadControls: CodeSwitchRoomDisplayPin,
});
