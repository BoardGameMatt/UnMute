import IKWYMProtocol from "./IKWYMProtocol";
import { IkwymLobbyExplainer } from "./components/IkwymLobbyExplainer";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "i-know-what-you-meme",
  name: "I Know What You Meme",
  description: "Answer the same two prompts with a GIF, then guess who picked each one.",
  type: "turnbased",
  minPlayers: 3,
  maxPlayers: 20,
  component: IKWYMProtocol,
  lobbyExplainer: IkwymLobbyExplainer,
});
