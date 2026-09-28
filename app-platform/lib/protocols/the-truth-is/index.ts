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
    prompt1: "What did you assume about someone that turned out to be wrong?",
    prompt2: "Where does that same assumption show up in how we work?",
  },
});
