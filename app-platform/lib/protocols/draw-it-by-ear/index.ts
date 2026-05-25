import DrawItByEarProtocol from "./DrawItByEarProtocol";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "draw-it-by-ear",
  name: "Draw It By Ear",
  description:
    "Build communication precision through a high-energy drawing challenge.",
  type: "realtime",
  minPlayers: 5,
  maxPlayers: 20,
  component: DrawItByEarProtocol,
});
