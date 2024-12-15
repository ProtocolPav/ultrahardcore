import {MinecraftDimensionTypes, Player, RawMessage, world} from "@minecraft/server";

export class MessageManager {
    tips: string[] = [];
    cycle: number = 0;

    constructor() {
        this.tips = [
            "Kill every team to win",
            "Careful! Avoid taking damage at all costs!"
        ];

        this.cycle = 0;
    }

    set_bar(game_time: number, running: boolean, waiting_to_start: boolean) {
        if (!running && !waiting_to_start) {
            world.getAllPlayers().forEach((player) => {
                player.onScreenDisplay.setActionBar(`§6Game is starting soon`)
            })
        }

        else if (!running && waiting_to_start) {
            this.game_start_cycle(game_time)
        }

        else if (running) {
            this.game_cycle(game_time)
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
            player.onScreenDisplay.setActionBar(`§6Game is starting in: §800:${time_until_start.toString().padStart(2, '0')}`)
        })
    }

    private game_cycle(game_time: number) {
        const minutes = Math.floor(game_time / 60).toString().padStart(2, "0");
        const seconds = Math.floor(game_time % 60).toString().padStart(2, "0");

        world.getAllPlayers().forEach((player) => {
            player.onScreenDisplay.setActionBar(`§8${minutes}:${seconds}`)
        })
    }
}