import {MinecraftDimensionTypes, Player, RawMessage, world} from "@minecraft/server";

export class MessageManager {

    set_bar(game_time: number, running: boolean, waiting_to_start: boolean, grace_period: number, end: number, deathmatch: boolean) {
        if (!running && !waiting_to_start) {
            world.getAllPlayers().forEach((player) => {
                player.onScreenDisplay.setActionBar(`§6Game is starting soon`)
            })
        }

        else if (!running && waiting_to_start) {
            this.game_start_cycle(game_time)
        }

        else if (running) {
            this.game_cycle(game_time, grace_period, end, deathmatch)
        }
    }

    send_message(message: string | RawMessage, sound?: string, player?: Player) {
        if (player) {
            if (sound) {
                player.playSound(sound, {location: player.location, volume: 100})
            }
            player.sendMessage(message)
        } else {
            if (sound) {
                world.getDimension(MinecraftDimensionTypes.overworld).playSound(sound, {x: 0, y:0, z: 0}, {volume:1000})
            }
            world.sendMessage(message)
        }
    }

    private game_start_cycle(game_time: number) {
        const time_until_start = Math.abs(game_time);

        if (time_until_start === 3) {
            world.getDimension(MinecraftDimensionTypes.overworld).playSound('uhc.start', {x: 0, y:0, z: 0}, {volume:1000})
        }

        world.getAllPlayers().forEach((player) => {
            player.onScreenDisplay.setActionBar(`§6Game is starting in: §h00:${time_until_start.toString().padStart(2, '0')}`)
        })
    }

    private game_cycle(game_time: number, grace_period: number, end: number, deathmatch: boolean) {
        let minutes = Math.floor(game_time / 60).toString().padStart(2, "0");
        let seconds = Math.floor(game_time % 60).toString().padStart(2, "0");
        let message = `§h${minutes}:${seconds}`

        if (game_time > (grace_period-5)*60 && game_time < grace_period*60) {
            let minutes = Math.floor((grace_period * 60 - game_time) / 60).toString().padStart(2, "0");
            let seconds = Math.floor((grace_period * 60 - game_time) % 60).toString().padStart(2, "0");

            message = `§6Grace period ends in §h${minutes}:${seconds}`
        }

        else if (game_time > (grace_period+end-5)*60 && game_time < (grace_period+end)*60) {
            let minutes = Math.floor(((grace_period + end) * 60 - game_time) / 60).toString().padStart(2, "0");
            let seconds = Math.floor(((grace_period + end) * 60 - game_time) % 60).toString().padStart(2, "0");
            message = `${deathmatch ? '§mDeathmatch starts' : '§6Game ends'} in §h${minutes}:${seconds}`
        }

        world.getAllPlayers().forEach((player) => {
            player.onScreenDisplay.setActionBar(message)
        })
    }
}