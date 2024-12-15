import {DisplaySlotId, MinecraftDimensionTypes, system, world} from "@minecraft/server";
import {TeamsManager} from "./teams";
import { MessageManager } from "./messagebar";

export class GameManager {
    teams_manager: TeamsManager;
    message_manager: MessageManager
    game_time: number;
    game_running: boolean;
    waiting_to_start: boolean
    initialized: boolean

    private constructor(teams_manager: TeamsManager, game_running: boolean, game_time: number, initialized: boolean, message_manager: MessageManager) {
        this.teams_manager = teams_manager;
        this.game_running = game_running;
        this.game_time = game_time;
        this.waiting_to_start = false
        this.initialized = initialized;
        this.message_manager = message_manager;

        system.runInterval(() => this.game_loop(), 20)
    }

    static initialize(): GameManager {
        let initialized = world.getDynamicProperty("uhc:initialized");

        let scoreboard_objective = world.scoreboard.getObjective('uhc:teams')

        if (!scoreboard_objective) {
            world.scoreboard.addObjective('uhc:teams', 'Teams');
        }

        const teams_manager = new TeamsManager();
        const messageBarManager = new MessageManager();

        if (!initialized) {
            const game_time = 0
            const game_running = false
            initialized = true;

            world.setDynamicProperty("uhc:game_time", game_time);
            world.setDynamicProperty("uhc:game_running", game_running);
            // @ts-ignore
            world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {objective: world.scoreboard.getObjective('uhc:teams')})
            world.setDynamicProperty("uhc:initialized", initialized);
        }

        return new GameManager(
            teams_manager,
            // @ts-ignore
            world.getDynamicProperty("uhc:game_running"),
            world.getDynamicProperty("uhc:game_time"),
            initialized,
            messageBarManager
        )
    }

    begin_countdown_to_start() {
        this.message_manager.send_message(
            `§l§e[UHC]§r The game is about to start! Lock in and get ready. May the best team win.`,
            'uhc.start.before'
            )
        world.stopMusic()
        this.waiting_to_start = true
        this.game_time = -30
    }

    private game_loop() {
        if (this.waiting_to_start || this.game_running) {
            this.game_time++

            if (this.game_time === 1) {
                this.waiting_to_start = false
                this.game_running = true

                // Code to start the game here!
            }
        }

        this.teams_manager.teams.forEach((team) => {team.update()})
        this.message_manager.set_bar(this.game_time, this.game_running, this.waiting_to_start)
    }
}