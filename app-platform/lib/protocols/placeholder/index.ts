import PlaceholderProtocol from "./PlaceholderProtocol";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "placeholder",
  name: "Placeholder",
  description: "Debug shell for session state and metadata.",
  type: "realtime",
  minPlayers: 2,
  maxPlayers: 20,
  component: PlaceholderProtocol,
});
