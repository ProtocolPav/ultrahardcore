import {
    DisplaySlotId,
    Effect,
    EntityComponentTypes,
    GameMode,
    ItemStack,
    Player,
    system,
    TicksPerSecond,
    TimeOfDay,
    world
} from "@minecraft/server";
import {TeamsManager} from "./teams";
import {MessageManager} from "./messagebar";
import {MinecraftEffectTypes, MinecraftItemTypes, MinecraftDimensionTypes} from "@minecraft/vanilla-data";
import {game_challenges} from "./challenge";
import check_build_challenge from "./challenge_scripts/build_challenge";
import check_lectern_challenge from "./challenge_scripts/lectern_challenge";
import check_visit_challenge from "./challenge_scripts/visit_challenge";
import check_jump_challenge from "./challenge_scripts/jump_challenge";
import check_blaze_challenge from "./challenge_scripts/blaze_challenge";
import check_halftime_challenge from "./challenge_scripts/halftime_challenge";
import check_trial_challenge from "./challenge_scripts/trial_challenge";
import check_wool_challenge from "./challenge_scripts/wool_challenge";
import {Settings} from "./settings";
import {BorderManager} from "./border";
import check_boat_challenge from "./challenge_scripts/boat_challenge";
import check_spear_challenge from "./challenge_scripts/spear_challenge";
import check_hoe_challenge from "./challenge_scripts/hoe_challenge";
import check_golden_apple_challenge from "./challenge_scripts/golden_apple_challenge";
import check_iron_armour_challenge from "./challenge_scripts/iron_armour_challenge";
import {find_and_trigger_bell} from "./utils/bell_loop";
import check_potion_challenge from "./challenge_scripts/potion_challenge";
import player_has_item from "./utils/check_player_has_item";

export class GameManager {
    teams_manager: TeamsManager;
    message_manager: MessageManager
    settings: Settings
    border_manager: BorderManager
    game_time: number;
    game_status: 'waiting' | 'starting' | 'running' | 'finished'
    initialized: boolean
    items: ItemStack[]
    challenges: typeof game_challenges

    opponent_team_left: boolean = false

    private constructor(
        teams_manager: TeamsManager,
        game_status: 'waiting' | 'starting' | 'running' | 'finished',
        game_time: number,
        initialized: boolean,
        message_manager: MessageManager,
        settings: Settings
    ) {
        this.teams_manager = teams_manager;
        this.game_status = game_status;
        this.game_time = game_time;
        this.initialized = initialized;
        this.message_manager = message_manager;
        this.settings = settings
        this.border_manager = new BorderManager(this.settings, this.message_manager);
        this.items = [
            new ItemStack(MinecraftItemTypes.Redstone, 1),
            new ItemStack(MinecraftItemTypes.ResinClump, 1),
            new ItemStack(MinecraftItemTypes.Honeycomb, 1),
            new ItemStack(MinecraftItemTypes.TurtleScute, 1),
            new ItemStack(MinecraftItemTypes.Emerald, 1),
            new ItemStack(MinecraftItemTypes.EchoShard, 1),
            new ItemStack(MinecraftItemTypes.PrismarineShard, 1),
            new ItemStack(MinecraftItemTypes.Diamond, 1),
            new ItemStack(MinecraftItemTypes.ShulkerShell, 1),
            new ItemStack(MinecraftItemTypes.AmethystShard, 1),
            new ItemStack(MinecraftItemTypes.PinkPetals, 1)
        ]

        this.challenges = game_challenges

        system.runInterval(() => this.game_loop(), 20)
        system.runInterval(() => this.challenge_loop(), 1)
        system.runInterval(() => this.bell_loop(), 10)
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
            const game_status = 'waiting'
            initialized = true;

            world.setDynamicProperty("uhc:game_time", game_time);
            world.setDynamicProperty("uhc:game_status", game_status);
            // @ts-ignore
            world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {objective: world.scoreboard.getObjective('uhc:teams')})
            world.setDynamicProperty("uhc:initialized", initialized);
        }

        return new GameManager(
            teams_manager,
            // @ts-ignore
            String(world.getDynamicProperty("uhc:game_status")),
            Number(world.getDynamicProperty("uhc:game_time")),
            initialized,
            messageBarManager,
            settings
        )
    }

    begin_countdown_to_start() {
        this.message_manager.send_message(
            `The game is about to start! ` +
            `Each team will be teleported to their starting locations in 15 seconds. May the best team win.`,
            'uhc.start.before'
            )

        system.runTimeout(() => {
            this.message_manager.send_message(
                `You might be teleported into the sky, do not worry! You will have resistance to save your fall.`,
                'random.toast'
            )
        }, TicksPerSecond*5)

        world.getAllPlayers().forEach((player: Player) => {
            player.getComponent(EntityComponentTypes.Inventory)?.container?.clearAll()
        })

        world.stopMusic()
        this.game_status = 'starting'
        this.game_time = -16
    }

    private challenge_loop() {
        if (this.game_status !== 'running' || this.game_time < 30) return;

        const total_time = this.settings.grace_period_mins*60 + this.settings.main_period_mins*60

        world.getAllPlayers().forEach((player: Player) => {
            if (this.teams_manager.get_team(player)) {
                check_visit_challenge(this.message_manager, this.challenges.visit_challenge, player)
                // Tame challenge checked via events
                check_halftime_challenge(this.message_manager, this.challenges.halftime_challenge, player, this.game_time, total_time/2)
                check_boat_challenge(this.message_manager, this.challenges.boat_challenge, player)
                // Kill challenge checked via events
                check_spear_challenge(this.message_manager, this.challenges.spear_challenge, player)

                check_hoe_challenge(this.message_manager, this.challenges.hoe_challenge, player, this.teams_manager)
                // Amethyst challenge checked via events
                // Villager challenge checked via events
                check_golden_apple_challenge(this.message_manager, this.challenges.gapple_challenge, player, this.teams_manager)

                check_iron_armour_challenge(this.message_manager, this.challenges.iron_armour_challenge, player, this.teams_manager)
                check_potion_challenge(this.message_manager, this.challenges.potion_challenge, player, this.teams_manager)
                // dandelion via events
            }
        })
    }

    private bell_loop() {
        system.runJob(find_and_trigger_bell())

        // TEMP THING FOR COMPASS FIX
        world.getAllPlayers().forEach((player: Player) => {
            if (player_has_item(player, MinecraftItemTypes.RecoveryCompass)) {
                player.setDynamicProperty('uhc:had_recovery_compass', true)
            } else {
                player.setDynamicProperty('uhc:had_recovery_compass', false)
            }
        })
    }

    private update_dynamic_properties() {
        world.setDynamicProperty("uhc:game_time", this.game_time);
        world.setDynamicProperty("uhc:game_status", this.game_status);
        this.teams_manager.teams.forEach((team) => {
            team.update()
        })
    }

    private start_game() {
        this.game_status = 'running'

        const beef = new ItemStack(MinecraftItemTypes.CookedBeef, 10)
        const water_bucket = new ItemStack(MinecraftItemTypes.WaterBucket, 1)
        const challenge_book = new ItemStack('uhc:challenge_book', 1)
        world.gameRules.pvp = false
        world.gameRules.naturalRegeneration = false
        world.gameRules.doInsomnia = false
        world.gameRules.showCoordinates = true
        world.gameRules.doImmediateRespawn = true
        world.gameRules.doMobSpawning = true
        world.gameRules.mobGriefing = true
        world.gameRules.doMobLoot = true
        world.gameRules.playersSleepingPercentage = 0
        world.gameRules.playerWaypoints = "off"
        world.setTimeOfDay(TimeOfDay.Day)

        world.getAllPlayers().forEach((player: Player) => {
            player.getEffects().forEach((effect: Effect) => {
                player.removeEffect(effect.typeId)
            })
            player.getComponent(EntityComponentTypes.Inventory)?.container?.clearAll()
            player.getComponent(EntityComponentTypes.Inventory)?.container?.addItem(beef)
            player.getComponent(EntityComponentTypes.Inventory)?.container?.addItem(water_bucket)
            player.getComponent(EntityComponentTypes.Inventory)?.container?.addItem(challenge_book)
            player.addEffect(MinecraftEffectTypes.HealthBoost, TicksPerSecond * 60 * 500, {amplifier: 1, showParticles: false})
            player.addEffect(MinecraftEffectTypes.InstantHealth, 1, {amplifier: 255})
            player.setGameMode(GameMode.Survival)
        })

        this.teams_manager.spread_teams(this.settings.border_radius)
    }

    private finish_game(team: any) {
        world.stopMusic()
        this.message_manager.send_message(`${team.get_team_name()} has won the UHC!`, 'uhc.team.win')
        world.playMusic('uhc.music.win', {volume: 2})
        this.game_status = 'finished'

        const winning_player = world.getPlayers({name: team.players[0].name})[0]

        world.getAllPlayers().forEach((player: Player) => {
            player.teleport(winning_player.location)
            player.setGameMode(GameMode.Survival)
            player.addEffect(MinecraftEffectTypes.Resistance, TicksPerSecond * 60 * 500, {amplifier: 100})
        })
    }

    private deathmatch() {
        world.stopMusic()
        world.playMusic('uhc.music.deathmatch', {volume: 0.6, loop: true})

        this.settings.border_radius = 100

        this.teams_manager.spread_teams(100)

        world.getPlayers({gameMode: GameMode.Spectator}).forEach((player: Player) => {
            player.teleport({x: 0, y: 100, z: 0})
        })
    }

    private game_loop() {
        if (this.game_status === 'starting') {
            this.game_time++

            if (this.game_time === 0) {
                this.start_game()
            }
        }

        else if (this.game_status === 'running') {
            // Core UHC loops
            this.game_time++

            this.border_manager.checkBorder();

            let team = this.teams_manager.winner_check()

            // If there are 2 teams remaining, and one team leaves, wait until they join back
            if (team && !this.opponent_team_left) {
                this.finish_game(team)
            }

            // Clear maps from players
            world.getDimension(MinecraftDimensionTypes.Overworld).runCommand('clear @a map')

            // Grace Period Ends
            if (this.game_time === this.settings.grace_period_mins*60 - 3) {
                world.getDimension(MinecraftDimensionTypes.Overworld).playSound('uhc.checkpoint', {x: 0, y:0, z: 0}, {volume:1000})
            }
            else if (this.game_time === this.settings.grace_period_mins*60) {
                world.gameRules.pvp = true
                this.message_manager.send_message('Grace Period has ended. PVP is now enabled. Good luck.')
            }

            // Halftime
            else if (this.game_time === (this.settings.main_period_mins+this.settings.grace_period_mins)*60/2 - 3) {
                world.getDimension(MinecraftDimensionTypes.Overworld).playSound('uhc.checkpoint', {x: 0, y:0, z: 0}, {volume:1000})
            }
            else if (this.game_time === (this.settings.main_period_mins+this.settings.grace_period_mins)*60/2) {
                let halftime_message = "Congratulations on making it through half of the game!"
                if (this.settings.halftime_regeneration) {
                    halftime_message = `${halftime_message} Each team has been granted regeneration for 30 seconds.`
                    world.getAllPlayers().forEach((player: Player) => {
                        player.addEffect(MinecraftEffectTypes.Regeneration, TicksPerSecond*30)
                    })
                }

                this.message_manager.send_message(halftime_message)
            }

            // Deathmatch
            else if (this.game_time === (this.settings.grace_period_mins+this.settings.main_period_mins)*60 - 5*60
                && this.settings.deathmatch_enabled) {
                this.message_manager.send_message(
                    'Deathmatch will commence in 3 minutes. The border will shrink to 100 blocks and ' +
                    'all teams will be teleported to the centre and granted Resistance for 60 seconds.'
                )
            }
            else if (this.game_time === (this.settings.grace_period_mins+this.settings.main_period_mins)*60 - 3) {
                world.getDimension(MinecraftDimensionTypes.Overworld).playSound('uhc.checkpoint', {x: 0, y:0, z: 0}, {volume:1000})
            }
            else if (this.game_time === (this.settings.grace_period_mins+this.settings.main_period_mins)*60) {
                if (this.settings.deathmatch_enabled) {
                    this.deathmatch()
                } else {
                    this.message_manager.send_message('The UHC has ended, and no team has won.')
                    this.game_status = 'finished'
                }
            }
        }

        else if (this.game_status === 'finished') {
            world.getAllPlayers().forEach((player: Player) => {
                player.dimension.spawnItem(
                    this.items[Math.floor(Math.random() * this.items.length)],
                    {
                        x: player.location.x + (Math.floor(Math.random() * 10) * Math.random() < 0.5 ? 1 : -1),
                        y: player.location.y + 12,
                        z: player.location.z + (Math.floor(Math.random() * 10) * Math.random() < 0.5 ? 1 : -1)
                    }
                )
            })
        }

        this.update_dynamic_properties()
        this.message_manager.set_bar(
            this.game_time,
            this.game_status,
            this.settings.grace_period_mins,
            this.settings.main_period_mins,
            this.settings.deathmatch_enabled
        )
    }
}