import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";

export default function check_halftime_challenge(
    message_manager: MessageManager,
    challenge: Challenge,
    player: Player,
    time: number,
    halftime: number
) {
    if (time >= halftime + 10 && time <= halftime + 12) {
        if (challenge.progress_challenge(player)) {
            message_manager.send_message(`${player.name} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}