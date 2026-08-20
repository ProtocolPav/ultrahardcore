import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {MinecraftItemTypes} from "@minecraft/vanilla-data";
import {TeamsManager} from "../teams";
import player_has_item from "../utils/check_player_has_item";

export default function check_iron_armour_challenge(message_manager: MessageManager, challenge: Challenge, player: Player, teams_manager: TeamsManager) {
    const helmet = player_has_item(player, MinecraftItemTypes.IronHelmet)
    const chestplate = player_has_item(player, MinecraftItemTypes.IronChestplate)
    const leggings = player_has_item(player, MinecraftItemTypes.IronLeggings)
    const boots = player_has_item(player, MinecraftItemTypes.IronBoots)
    const shield = player_has_item(player, MinecraftItemTypes.Shield)

    if (helmet && chestplate && leggings && boots && shield) {
        if (challenge.progress_challenge(player)) {
            const team = teams_manager.get_team(player)
            message_manager.send_message(`${team?.get_team_name()} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}