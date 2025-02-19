import {Challenge} from "../challenge";
import {Player, world} from "@minecraft/server";
import {MessageManager} from "../messagebar";

export default function check_visit_challenge(message_manager: MessageManager, challenge: Challenge, player: Player) {
    const player_location = {x: Math.round(player.location.x), z: Math.round(player.location.z)};
    console.log(Math.sqrt(Math.pow(player_location.x, 2) + Math.pow(player_location.z, 2)))

    if (Math.sqrt(Math.pow(player_location.x, 2) + Math.pow(player_location.z, 2)) <= 20) {
        if (challenge.progress_challenge(player)) {
            message_manager.send_message(`${player.name} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}