import SayLessProtocol from "./SayLessProtocol";
import { SayLessLobbyExplainer } from "./components/SayLessLobbyExplainer";
import { SayLessLobbyFooter } from "./components/SayLessLobbyFooter";
import { SayLessLobbyLead } from "./components/SayLessLobbyLead";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "say-less",
  name: "Say Less",
  description:
    "Two teams build a shared shorthand: describe freely, then the same cards in one word.",
  type: "realtime",
  minPlayers: 4,
  maxPlayers: 14,
  component: SayLessProtocol,
  lobbyExplainer: SayLessLobbyExplainer,
  lobbyLeadControls: SayLessLobbyLead,
  lobbyFooter: SayLessLobbyFooter,
  reflectionPrompts: {
    prompt1: "Which one-word clue did you assume would land, and it didn't?",
    prompt2:
      "Where does our team's shorthand help us, and where might it hide where we mean different things?",
    prompt3: "What phrase do we use when we don't want to say something directly?",
  },
});
