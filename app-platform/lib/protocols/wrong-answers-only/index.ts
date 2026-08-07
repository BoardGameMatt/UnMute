import WrongAnswersOnlyProtocol from "./WrongAnswersOnlyProtocol";
import { WaoLobbyExplainer } from "./components/WaoLobbyExplainer";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "wrong-answers-only",
  name: "Wrong Answers Only",
  description:
    "Pairs silently agree on which answers to eliminate — concurrence under constraint.",
  type: "realtime",
  minPlayers: 2,
  maxPlayers: 24,
  component: WrongAnswersOnlyProtocol,
  lobbyExplainer: WaoLobbyExplainer,
});
