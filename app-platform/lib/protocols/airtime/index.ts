import AirtimeProtocol from "./AirtimeProtocol";
import { AirtimeLobbyExplainer } from "./components/AirtimeLobbyExplainer";
import { AirtimeLobbyFooter } from "./components/AirtimeLobbyFooter";
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
  lobbyFooter: AirtimeLobbyFooter,
  reflectionPrompts: {
    prompt1: "Are there instances when the success of the team is dependent on the efforts/actions of an individual?",
    prompt2: "Have there been times where it's been challenging to voice a difficult truth or share a new idea which might benefit the team?",
  },
});
