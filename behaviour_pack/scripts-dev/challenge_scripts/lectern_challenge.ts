import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import player_has_item from "../utils/check_player_has_item";
import {MinecraftItemTypes} from "@minecraft/vanilla-data";

export default function check_lectern_challenge(message_manager: MessageManager, challenge: Challenge, player: Player) {
    if (player_has_item(player, MinecraftItemTypes.Lectern)) {
        if (challenge.progress_challenge(player)) {
            message_manager.send_message(`${player.name} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}