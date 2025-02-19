import {Challenge} from "../challenge";
import {Player, world} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {TeamsManager} from "../teams";

let jump_dict: {[p: string]: {x: number, y: number, z: number, time: Date}} = {}

export default function check_jump_challenge(message_manager: MessageManager, challenge: Challenge, player: Player, teams_manager: TeamsManager) {
    const current_time = new Date()

    if (world.getDimension("minecraft:overworld").heightRange.max === Math.round(player.location.y)) {
        jump_dict[player.name] = {
            x: Math.round(player.location.x),
            y: Math.round(player.location.y),
            z: Math.round(player.location.z),
            time: current_time
        }
    }

    else if (
        jump_dict[player.name]
        && world.getDimension("minecraft:overworld").heightRange.min + 20 >= Math.round(player.location.y)
        && current_time.getTime() - jump_dict[player.name].time.getTime() < 10*1000 // 10s to ms
    ) {
        if (challenge.progress_challenge(player)) {
            const team = teams_manager.get_team(player)
            message_manager.send_message(`${team?.get_team_name()} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }

    else if (jump_dict[player.name] && current_time.getTime() - jump_dict[player.name].time.getTime() >= 10*1000) {
        delete jump_dict[player.name]
    }
}