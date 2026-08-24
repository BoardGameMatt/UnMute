import TalkTrackProtocol from "./TalkTrackProtocol";
import { TalkTrackLobbyExplainer } from "./components/TalkTrackLobbyExplainer";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "talk-track",
  name: "Talk Track",
  description:
    "Teams build a spoken sentence one word at a time so a teammate can name the word on the card.",
  type: "realtime",
  minPlayers: 4,
  maxPlayers: 20,
  component: TalkTrackProtocol,
  lobbyExplainer: TalkTrackLobbyExplainer,
});
