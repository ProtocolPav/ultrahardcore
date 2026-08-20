import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {MinecraftItemTypes} from "@minecraft/vanilla-data";
import player_has_unique_item from "../utils/check_unique_item";
import {TeamsManager} from "../teams";

export default function check_hoe_challenge(message_manager: MessageManager, challenge: Challenge, player: Player, teams_manager: TeamsManager) {
    if (player_has_unique_item(player, MinecraftItemTypes.DiamondHoe)) {
        if (challenge.progress_challenge(player)) {
            const team = teams_manager.get_team(player)
            message_manager.send_message(`${team?.get_team_name()} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}