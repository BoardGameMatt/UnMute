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
  reflectionPrompts: {
    prompt1:
      "As a guesser, did you feel more supported by the convergent or divergent rounds?",
    prompt2:
      "What's a recent example of a time when a colleague presented a different perspective that helped add nuance/clarity to a situation?",
  },
});
