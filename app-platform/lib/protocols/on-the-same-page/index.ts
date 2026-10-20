import OnTheSamePageProtocol from "./OnTheSamePageProtocol";
import { OtspLobbyExplainer } from "./components/OtspLobbyExplainer";
import { OtspRoomDisplayPin } from "./components/OtspRoomDisplayPin";
import { BRIDGE_LINE, OTSP, REFLECTION_PROMPT_1, REFLECTION_PROMPT_2, REFLECTION_PROMPT_3 } from "./config";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "on-the-same-page",
  name: "On the Same Page",
  description:
    "Five players build a picture. Four know it. One is improvising. Everyone else names the picture and spots the Improviser.",
  type: "realtime",
  minPlayers: OTSP.minPlayers,
  maxPlayers: OTSP.maxPlayers,
  component: OnTheSamePageProtocol,
  lobbyExplainer: OtspLobbyExplainer,
  lobbyLeadControls: OtspRoomDisplayPin,
  reflectionPrompts: {
    prompt1: REFLECTION_PROMPT_1,
    prompt2: REFLECTION_PROMPT_2,
    prompt3: REFLECTION_PROMPT_3,
    preface: BRIDGE_LINE,
  },
});
