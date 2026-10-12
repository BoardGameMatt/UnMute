import AirtimeProtocol from "./AirtimeProtocol";
import { AirtimeLobbyExplainer } from "./components/AirtimeLobbyExplainer";
import { AirtimeRoomDisplayPin } from "./components/AirtimeRoomDisplayPin";
import { AIRTIME_CONFIG } from "./config";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "airtime",
  name: "Airtime",
  description:
    "Boats of divers share one oxygen tank. Underwater divers can't talk and see only a rough gauge; the crew on the surface sees everything.",
  type: "realtime",
  minPlayers: AIRTIME_CONFIG.minPlayers,
  maxPlayers: AIRTIME_CONFIG.maxPlayers,
  component: AirtimeProtocol,
  lobbyExplainer: AirtimeLobbyExplainer,
  lobbyLeadControls: AirtimeRoomDisplayPin,
  reflectionPrompts: {
    prompt1: "Nobody said scoring was individual. Who assumed it was, and how did that change your dive?",
    prompt2: "Have there been times in our work as a team where it's been challenging to voice a difficult truth?",
  },
});
