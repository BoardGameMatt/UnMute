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
      "Were there instances in Rank & File where the team didn't have a shared understanding? When has this turned up in our work?",
    prompt2:
      "If you had one question you could have asked before ordering responses, what would it have been? As a team, do we appropriately ask clarifying questions on the things that matter most?",
  },
});
