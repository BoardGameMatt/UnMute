import TheTruthIsProtocol from "./TheTruthIsProtocol";
import { TruthIsLobbyExplainer } from "./components/TruthIsLobbyExplainer";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "the-truth-is",
  name: "The Truth Is...",
  description:
    "Anonymous truths, read aloud, guess the author — structured vulnerability for teams.",
  type: "turnbased",
  minPlayers: 3,
  maxPlayers: 20,
  component: TheTruthIsProtocol,
  lobbyExplainer: TruthIsLobbyExplainer,
  reflectionPrompts: {
    prompt1:
      "Was it challenging in deciding what truths to reveal about yourself? Why or why not?",
    prompt2:
      "Was it difficult to determine which truths belonged to the other members of your team? Why or why not?",
  },
});
