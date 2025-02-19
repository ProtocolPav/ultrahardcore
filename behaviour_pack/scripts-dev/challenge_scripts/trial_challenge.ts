import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {TeamsManager} from "../teams";
import {MinecraftItemTypes} from "@minecraft/vanilla-data";
import player_has_item from "../utils/check_player_has_item";

export default function check_trial_challenge(
    message_manager: MessageManager,
    challenge: Challenge,
    player: Player,
    teams_manager: TeamsManager
) {
    if (player_has_item(player, MinecraftItemTypes.OminousTrialKey)) {
        if (challenge.progress_challenge(player)) {
            const team = teams_manager.get_team(player)
            message_manager.send_message(`${team?.get_team_name()} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}