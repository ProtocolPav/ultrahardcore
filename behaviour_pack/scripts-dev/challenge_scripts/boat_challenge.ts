import {Challenge} from "../challenge";
import {EntityComponentTypes, Player, world} from "@minecraft/server";
import {MessageManager} from "../messagebar";
import {MinecraftEntityTypes} from "@minecraft/vanilla-data";

let travel_dict: {[p: string]: {x: number, z: number}[]} = {}

export default function check_boat_challenge(message_manager: MessageManager, challenge: Challenge, player: Player) {
    if (!travel_dict[player.name]) {travel_dict[player.name] = []}
    const player_location = {x: Math.round(player.location.x), z: Math.round(player.location.z)};
    const coord = travel_dict[player.name]
        .find(
            (coordinate) => coordinate.x === player_location.x && coordinate.z === player_location.z
        )

    const is_on_boat = player.getComponent(EntityComponentTypes.Riding)?.entityRidingOn.typeId === MinecraftEntityTypes.Boat

    if (!coord && is_on_boat) {
        travel_dict[player.name].push(player_location)
        if (challenge.progress_challenge(player)) {
            message_manager.send_message(`${player.name} has completed ${challenge.name}!`, 'uhc.team.win')
        }
    }
}