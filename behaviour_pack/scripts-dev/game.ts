import {Effect, EntityComponentTypes, GameMode, ItemStack, Player, system, TimeOfDay, world} from "@minecraft/server";
import {TeamsManager} from "./teams";
import {MessageManager} from "./messagebar";
import {MinecraftEffectTypes, MinecraftItemTypes} from "@minecraft/vanilla-data";

class Settings {
    border_radius: number;
    players_per_team: number;
    loot_chests_enabled: boolean;
    centre_chests_enabled: boolean;
    grace_period_mins: number;
    main_period_mins: number;
    deathmatch_enabled: boolean;
    halftime_regeneration: boolean;

    constructor(initialized: boolean) {
        if (!initialized) {
            this.border_radius = 1500
            this.players_per_team = 3
            this.loot_chests_enabled = true
            this.centre_chests_enabled = true
            this.grace_period_mins = 30
            this.main_period_mins = 60
            this.deathmatch_enabled = true
            this.halftime_regeneration = true

            this.update_settings()
        } else {
            this.border_radius = Number(world.getDynamicProperty('uhc:border'))
            this.players_per_team = Number(world.getDynamicProperty('uhc:players_per_team'))
            this.loot_chests_enabled = Boolean(world.getDynamicProperty('uhc:loot_chests_enabled'))
            this.centre_chests_enabled = Boolean(world.getDynamicProperty('uhc:centre_chests_enabled'))
            this.grace_period_mins = Number(world.getDynamicProperty('uhc:grace_period_mins'))
            this.main_period_mins = Number(world.getDynamicProperty('uhc:main_period_mins'))
            this.deathmatch_enabled = Boolean(world.getDynamicProperty('uhc:deathmatch_enabled'))
            this.halftime_regeneration = Boolean(world.getDynamicProperty('uhc:halftime_regeneration'))
        }
    }

    update_settings(): void {
        world.setDynamicProperty('uhc:border', this.border_radius)
        world.setDynamicProperty('uhc:players_per_team', this.players_per_team)
        world.setDynamicProperty('uhc:loot_chests_enabled', this.loot_chests_enabled)
        world.setDynamicProperty('uhc:centre_chests_enabled', this.centre_chests_enabled)
        world.setDynamicProperty('uhc:grace_period_mins', this.grace_period_mins)
        world.setDynamicProperty('uhc:main_period_mins', this.main_period_mins)
        world.setDynamicProperty('uhc:deathmatch_enabled', this.deathmatch_enabled)
        world.setDynamicProperty('uhc:halftime_regeneration', this.halftime_regeneration)
    }
}

export class GameManager {
    teams_manager: TeamsManager;
    message_manager: MessageManager
    settings: Settings
    game_time: number;
    game_running: boolean;
    waiting_to_start: boolean
    initialized: boolean

    private constructor(teams_manager: TeamsManager, game_running: boolean, game_time: number, initialized: boolean, message_manager: MessageManager, settings: Settings) {
        this.teams_manager = teams_manager;
        this.game_running = game_running;
        this.game_time = game_time;
        this.waiting_to_start = false
        this.initialized = initialized;
        this.message_manager = message_manager;
        this.settings = settings

        system.runInterval(() => this.game_loop(), 20)
    }

    static initialize(): GameManager {
        let initialized = Boolean(world.getDynamicProperty("uhc:initialized"));

        let scoreboard_objective = world.scoreboard.getObjective('uhc:teams')

        if (!scoreboard_objective) {
            world.scoreboard.addObjective('uhc:teams', 'Teams');
        }

        const teams_manager = new TeamsManager();
        const messageBarManager = new MessageManager();
        const settings = new Settings(initialized)

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
            Boolean(world.getDynamicProperty("uhc:game_running")),
            Number(world.getDynamicProperty("uhc:game_time")),
            initialized,
            messageBarManager,
            settings
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

    private start_game() {
        this.waiting_to_start = false
        this.game_running = true

        const beef = new ItemStack(MinecraftItemTypes.CookedBeef, 10)
        world.gameRules.pvp = false
        world.gameRules.naturalRegeneration = false
        world.setTimeOfDay(TimeOfDay.Day)

        world.getAllPlayers().forEach((player: Player) => {
            player.getEffects().forEach((effect: Effect) => {
                player.removeEffect(effect.typeId)
            })
            player.getComponent(EntityComponentTypes.Inventory)?.container?.clearAll()
            player.getComponent(EntityComponentTypes.Inventory)?.container?.addItem(beef)
            player.addEffect(MinecraftEffectTypes.Resistance, 30, {amplifier: 100})
            player.setGameMode(GameMode.survival)
        })

        this.teams_manager.spread_teams(this.settings.border_radius)
    }

    private game_loop() {
        if (this.waiting_to_start || this.game_running) {
            this.game_time++

            if (this.game_time === 0) {
                this.start_game()
            }
        }

        this.teams_manager.teams.forEach((team) => {team.update()})
        this.message_manager.set_bar(this.game_time, this.game_running, this.waiting_to_start)
    }
}