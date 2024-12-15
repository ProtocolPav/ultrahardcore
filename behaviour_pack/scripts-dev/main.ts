import {
    EntityComponentTypes,
    GameMode,
    ItemStack,
    system,
    TicksPerSecond,
    world
} from "@minecraft/server";
import {GameManager} from "./game";
import {MinecraftEffectTypes, MinecraftItemTypes} from "@minecraft/vanilla-data";
import {team_form} from "./forms/team";
import {admin_form} from "./forms/admin";

let game_manager: GameManager

world.afterEvents.worldInitialize.subscribe(event => {
    game_manager = GameManager.initialize()
})

world.afterEvents.playerSpawn.subscribe(event => {
    if (!game_manager.game_running && event.initialSpawn) {
        let team_book = new ItemStack(MinecraftItemTypes.Book, 1)
        team_book.setLore(['Select your UHC Team'])
        team_book.nameTag = '§r§fTeam Selector | §l§8[§r§bUse§l§8]§r'
        event.player.playMusic('uhc.music', {loop: true, volume: 0.5})
        event.player.getComponent(EntityComponentTypes.Inventory)
            ?.container
            ?.addItem(
                team_book
            )

        event.player.setGameMode(GameMode.adventure)
        event.player.addEffect(MinecraftEffectTypes.Resistance, 20000000, {showParticles: false, amplifier: 100})

        system.runTimeout(() => {
            game_manager.message_manager.send_message(
                `§l§e[UHC]§r Welcome, §l${event.player.name}§r to the §6Everthorn UHC §l4§r! The game is about to start. Sit back, relax, and good luck!`,
                'random.toast',
                event.player
            )
        }, TicksPerSecond*5)
        system.runTimeout(() => {
            game_manager.message_manager.send_message(
                {"text": `§l§e[UHC]§r Select your team by pressing :_input_key.use: or  on mobile`},
                'random.toast',
                event.player
            )
        }, TicksPerSecond*8)
        system.runTimeout(() => {
            game_manager.message_manager.send_message(
                `§l§e[UHC]§r For admins: To start the game and edit settings, right click any Paper`,
                'random.toast',
                event.player
            )
        }, TicksPerSecond*18)
    }
})

world.afterEvents.itemUse.subscribe(event => {
    if (event.itemStack.typeId === MinecraftItemTypes.Book && !game_manager.game_running) {
        team_form(game_manager, event.source)
    }

    else if (event.itemStack.typeId === MinecraftItemTypes.Paper && !game_manager.game_running) {
        admin_form(game_manager, event.source)
    }
});