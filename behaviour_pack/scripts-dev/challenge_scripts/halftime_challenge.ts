import {Challenge} from "../challenge";
import {Player} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {TeamsManager} from "../teams";

export default function check_halftime_challenge(
    message_manager: MessageManager,
    challenge: Challenge,
    player: Player,
    teams_manager: TeamsManager,
    time: number,
    halftime: number
) {
    if (time >= halftime && time <= halftime + 2) {
        if (challenge.progress_challenge(player)) {
            const team = teams_manager.get_team(player)
            message_manager.send_message(`${team?.get_team_name()} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}