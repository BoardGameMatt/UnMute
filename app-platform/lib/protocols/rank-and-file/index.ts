import RankAndFileProtocol from "./RankAndFileProtocol";
import { RankAndFileLobbyExplainer } from "./components/RankAndFileLobbyExplainer";
import { RankAndFileRoomDisplayPin } from "./components/RankAndFileRoomDisplayPin";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "rank-and-file",
  name: "Rank and File",
  description:
    "A subset of the room writes examples at a secret number on a shared scale. The team ranks them from low to high.",
  type: "realtime",
  minPlayers: 3,
  maxPlayers: 20,
  component: RankAndFileProtocol,
  lobbyExplainer: RankAndFileLobbyExplainer,
  lobbyLeadControls: RankAndFileRoomDisplayPin,
  reflectionPrompts: {
    prompt1:
      "Was there a word whose meaning we don't have a shared understanding of? Where has this turned up in our work?",
    prompt2:
      "If you had one question you could have asked before ordering, what would it have been? As a team, do we ask those questions on the things that matter most?",
  },
});
