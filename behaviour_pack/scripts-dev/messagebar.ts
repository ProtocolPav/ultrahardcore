import {MinecraftDimensionTypes, Player, RawMessage, world} from "@minecraft/server";

interface MessageType {
    cycle_length: number
    type: string
}

export class MessageManager {
    tips: string[] = [];
    tip: string
    cycle: number = 0;
    cycle_index: number = 0
    cycle_message_type: MessageType[]

    constructor() {
        this.tips = [
            "Kill every team to win",
            "Natural regeneration is off - don't take damage.",
            "When you see a team, it's either fight or flight",
        ];
        this.tip = ''

        this.cycle = 0;
        this.cycle_index = 0
        // this.cycle_message_type = [
        //     {cycle_length: 120, type: 'time'},
        //     {cycle_length: 20, type: 'tip'},
        //     {cycle_length: 200, type: 'time'},
        //     {cycle_length: 30, type: 'time_left'},
        //     {cycle_length: 200, type: 'time'},
        //     {cycle_length: 30, type: 'time_left'}
        // ]
        this.cycle_message_type = [
            {cycle_length: 20, type: 'time'},
            {cycle_length: 20, type: 'tip'},
            {cycle_length: 20, type: 'time_left'}
        ]
    }

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
        let message = ''
        const message_type = this.cycle_message_type[this.cycle_index]

        if (message_type.type === 'time') {
            let minutes = Math.floor(game_time / 60).toString().padStart(2, "0");
            let seconds = Math.floor(game_time % 60).toString().padStart(2, "0");
            message = `§h${minutes}:${seconds}`
        }

        else if (message_type.type === 'tip') {
            let minutes = Math.floor(game_time / 60).toString().padStart(2, "0");
            let seconds = Math.floor(game_time % 60).toString().padStart(2, "0");
            message = `§h${minutes}:${seconds} | ${this.tip}`
        }

        else if (message_type.type === 'time_left') {
            let minutes = Math.floor((grace_period + end - game_time) / 60).toString().padStart(2, "0");
            let seconds = Math.floor((grace_period + end - game_time) % 60).toString().padStart(2, "0");

            if (game_time < grace_period) {
                message = `§6Grace period ends in §h${minutes}:${seconds}`
            } else if (deathmatch) {
                message = `§mDeathmatch starts in §h${minutes}:${seconds}`
            } else {
                message = `§6Game ends in §h${minutes}:${seconds}`
            }
        }

        this.cycle++

        if (this.cycle > message_type.cycle_length) {
            this.cycle = 0
            this.cycle_index++
            this.tip = this.tips[Math.floor(Math.random() * this.tips.length)]
        }

        world.getAllPlayers().forEach((player) => {
            player.onScreenDisplay.setActionBar(message)
        })
    }
}