import {
    EntityComponentTypes,
    GameMode,
    ItemStack,
    Player,
    system,
    TicksPerSecond, Vector3,
    world
} from "@minecraft/server";
import {GameManager} from "./game";
import {MinecraftBlockTypes, MinecraftEffectTypes, MinecraftEntityTypes} from "@minecraft/vanilla-data";
import {team_form} from "./forms/team";
import {admin_form} from "./forms/admin";
import {challenges_form} from "./forms/challenges";

let game_manager: GameManager

system.beforeEvents.startup.subscribe(event => {
    system.run(() => game_manager = GameManager.initialize())
})

world.afterEvents.playerSpawn.subscribe(event => {
    if (game_manager.game_status !== 'running' && event.initialSpawn) {
        event.player.getComponent(EntityComponentTypes.Inventory)?.container?.clearAll()
        let team_book = new ItemStack('uhc:teams_book', 1)
        let challenge_book = new ItemStack('uhc:challenge_book', 1)
        event.player.playMusic('uhc.music', {loop: true, volume: 0.5})
        event.player.getComponent(EntityComponentTypes.Inventory)
            ?.container
            ?.addItem(
                team_book
            )
        event.player.getComponent(EntityComponentTypes.Inventory)
            ?.container
            ?.addItem(
                challenge_book
            )

        event.player.setGameMode(GameMode.Adventure)
        event.player.addEffect(MinecraftEffectTypes.Resistance, 20000000, {showParticles: false, amplifier: 100})

        system.runTimeout(() => {
            game_manager.message_manager.send_message(
                `Welcome, §l${event.player.name}§r to the §6Everthorn UHC §l4§r! The game is about to start. Sit back, relax, and good luck!`,
                'random.toast',
                event.player
            )
        }, TicksPerSecond*5)
        system.runTimeout(() => {
            game_manager.message_manager.send_message(
                `Select your team by pressing :_input_key.use:`,
                'random.toast',
                event.player
            )
        }, TicksPerSecond*8)
        system.runTimeout(() => {
            game_manager.message_manager.send_message(
                `For admins: §e/give @p uhc:admin_book§r to edit settings and start the game`,
                'random.toast',
                event.player
            )
        }, TicksPerSecond*18)
    }
    else if (game_manager.game_status === 'running' && event.initialSpawn && game_manager.opponent_team_left) {
        game_manager.teams_manager.teams.forEach((team) => {
            team.update()
        })
        game_manager.opponent_team_left = false

        game_manager.message_manager.send_message(
            `The UHC has been resumed. Good Luck!`,
            'random.toast'
        )
    }
    else if (game_manager.game_status === 'running' && !event.initialSpawn) {
        if (!game_manager.teams_manager.get_team(event.player)) {
            event.player.setGameMode(GameMode.Spectator)

            const death_location: Vector3 = event.player.getDynamicProperty('uhc:death_location') as Vector3
            
            if (death_location) {
                event.player.teleport(death_location)
            }
        }
    }
})

world.beforeEvents.playerLeave.subscribe(event => {
    const team = game_manager.teams_manager.get_team(event.player)
    const alive_teams = game_manager.teams_manager.teams.filter(team => team.players.length > 0)

    if (team && team.players.length === 1 && alive_teams.length == 2) {
        game_manager.opponent_team_left = true

        game_manager.message_manager.send_message(
            `Team ${team.get_team_name()} has left. The UHC is paused until they reconnect.`,
            'random.toast'
        )
    }
})

world.afterEvents.itemUse.subscribe(event => {
    if (event.itemStack.typeId === 'uhc:teams_book' && game_manager.game_status !== 'running') {
        team_form(game_manager, event.source)
    }

    else if (event.itemStack.typeId === 'uhc:admin_book') {
        admin_form(game_manager, event.source)
    }

    else if (event.itemStack.typeId === 'uhc:challenge_book') {
        challenges_form(game_manager, event.source)
    }
})

world.afterEvents.entityDie.subscribe(event => {
    if (event.deadEntity instanceof Player) {
        const team = game_manager.teams_manager.get_team(event.deadEntity)
        if (team) {
            team.remove_player(event.deadEntity, game_manager.message_manager)
            event.deadEntity.setDynamicProperty('uhc:death_location', event.deadEntity.location)
        }
    }
})


// Event-Based Challenges

// Elimination Challenge
world.afterEvents.entityDie.subscribe(event => {
    if (game_manager.game_status === 'running') {
        const this_challenge = game_manager.challenges.eliminate_challenge
        if (event.deadEntity instanceof Player && event.damageSource.damagingEntity instanceof Player) {
            const dead_team = game_manager.teams_manager.get_team(event.deadEntity)
            const killing_team = game_manager.teams_manager.get_team(event.damageSource.damagingEntity)

            if (dead_team?.string_id !== killing_team?.string_id && dead_team?.players.length === 1) {
                if (this_challenge.progress_challenge(event.damageSource.damagingEntity)) {
                    game_manager.message_manager.send_message(`${killing_team?.get_team_name()} has completed ${this_challenge.name}!`, 'uhc.team.win')
                }
            }
        }
    }
})

// Mining Challenge
const valid_blocks: string[] = [
    MinecraftBlockTypes.GoldOre, MinecraftBlockTypes.DeepslateGoldOre,
    MinecraftBlockTypes.DiamondOre, MinecraftBlockTypes.DeepslateDiamondOre,
    MinecraftBlockTypes.IronOre, MinecraftBlockTypes.DeepslateIronOre,
    MinecraftBlockTypes.EmeraldOre, MinecraftBlockTypes.DeepslateEmeraldOre,
    MinecraftBlockTypes.RedstoneOre, MinecraftBlockTypes.DeepslateRedstoneOre,
    MinecraftBlockTypes.AncientDebris
]

world.beforeEvents.playerBreakBlock.subscribe(event => {
    if (game_manager.game_status === 'running') {
        const this_challenge = game_manager.challenges.mining_challenge
        if (valid_blocks.includes(event.block.typeId)) {
            const team = game_manager.teams_manager.get_team(event.player)

            if (this_challenge.progress_challenge(event.player)) {
                game_manager.message_manager.send_message(`${team?.get_team_name()} has completed ${this_challenge.name}!`, 'uhc.team.win')
            }
        }
    }
})

// Skeleton Challenge
world.afterEvents.entityDie.subscribe(event => {
    if (game_manager.game_status === 'running') {
        const this_challenge = game_manager.challenges.skeleton_challenge

        if (
            event.deadEntity.typeId === MinecraftEntityTypes.Skeleton
            && event.damageSource.damagingEntity instanceof Player
        ) {
            const team = game_manager.teams_manager.get_team(event.damageSource.damagingEntity)

            if (this_challenge.progress_challenge(event.damageSource.damagingEntity)) {
                game_manager.message_manager.send_message(`${team?.get_team_name()} has completed ${this_challenge.name}!`, 'uhc.team.win')
            }
        }
    }
})