import TheTruthIsProtocol from "./TheTruthIsProtocol";
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
});
