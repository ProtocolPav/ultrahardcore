import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {MinecraftItemTypes} from "@minecraft/vanilla-data";
import player_has_unique_item from "../utils/check_unique_item";

export default function check_spear_challenge(message_manager: MessageManager, challenge: Challenge, player: Player) {
    if (player_has_unique_item(player, MinecraftItemTypes.DiamondSpear)) {
        if (challenge.progress_challenge(player)) {
            message_manager.send_message(`${player.name} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}