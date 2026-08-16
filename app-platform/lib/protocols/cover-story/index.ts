import CoverStoryProtocol from "./CoverStoryProtocol";
import { CoverStoryLobbyExplainer } from "./components/CoverStoryLobbyExplainer";
import { CoverStoryLobbyLead } from "./components/CoverStoryLobbyLead";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "cover-story",
  name: "Cover Story",
  description:
    "A short reading, then weeks of spoken cover words, then a scored reveal.",
  type: "async",
  minPlayers: 2,
  maxPlayers: 15,
  component: CoverStoryProtocol,
  lobbyExplainer: CoverStoryLobbyExplainer,
  lobbyLeadControls: CoverStoryLobbyLead,
});
