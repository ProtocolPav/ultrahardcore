import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {TeamsManager} from "../teams";
import player_has_item_like from "../utils/player_has_similar_item";

export default function check_wool_challenge(
    message_manager: MessageManager,
    challenge: Challenge,
    player: Player,
    teams_manager: TeamsManager
) {
    const team = teams_manager.get_team(player)

    if (team) {
        const wools_present = player_has_item_like(player, '^minecraft:[a-z]+_wool$')

        if (wools_present.length === 16) {
            if (challenge.progress_challenge(player)) {
                const team = teams_manager.get_team(player)
                message_manager.send_message(`${team?.get_team_name()} has completed ${challenge.name}!`, 'uhc.team.win')
            }
        }
    }
}