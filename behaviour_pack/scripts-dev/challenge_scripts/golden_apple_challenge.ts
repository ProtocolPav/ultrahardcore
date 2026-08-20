import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {MinecraftItemTypes} from "@minecraft/vanilla-data";
import player_has_unique_item from "../utils/check_unique_item";
import {TeamsManager} from "../teams";

export default function check_golden_apple_challenge(message_manager: MessageManager, challenge: Challenge, player: Player, teams_manager: TeamsManager) {
    const unique_apple_count = player_has_unique_item(player, MinecraftItemTypes.GoldenApple)
    if (unique_apple_count) {
        for (let i = 0; i < unique_apple_count; i++) {
            if (challenge.progress_challenge(player)) {
                const team = teams_manager.get_team(player)
                message_manager.send_message(`${team?.get_team_name()} has completed ${challenge.name}!`, 'uhc.team.win')
            }
        }
    }
}