import IKWYMProtocol from "./IKWYMProtocol";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "i-know-what-you-meme",
  name: "I Know What You Meme",
  description:
    "Respond with GIFs, then guess who picked what — workplace-safe meme energy.",
  type: "turnbased",
  minPlayers: 3,
  maxPlayers: 20,
  component: IKWYMProtocol,
});
