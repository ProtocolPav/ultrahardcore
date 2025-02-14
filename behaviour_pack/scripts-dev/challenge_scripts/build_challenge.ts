import {Challenge} from "../challenge";
import {Player, world} from "@minecraft/server";
import {MessageManager} from "../messagebar";

export default function check_build_challenge(message_manager: MessageManager, challenge: Challenge, player: Player) {
    if (world.getDimension("minecraft:overworld").heightRange.max === Math.round(player.location.y)) {
        if (challenge.progress_challenge(player)) {
            message_manager.send_message(`${player.name} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}