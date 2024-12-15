import {
    EntityComponentTypes,
    GameMode,
    InputMode,
    ItemStack,
    MinecraftDimensionTypes,
    system,
    TicksPerSecond,
    world
} from "@minecraft/server";
import {ActionFormData, MessageFormData} from "@minecraft/server-ui";
import {GameManager} from "./game";
import {MinecraftEffectTypes, MinecraftItemTypes} from "@minecraft/vanilla-data";

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
        const form = new ActionFormData();
        form.title('Select a Team')
        game_manager.teams_manager.teams.forEach(team => {
            form.button(team.get_team_name(), team.icon)
        })

        // @ts-ignore
        form.show(event.source).then(r => {
            // This will stop the code when the player closes the form
            if (r.canceled) return;

            let response = r.selection;

            if (response !== undefined) {
                game_manager.teams_manager.teams[response].add_player(event.source, game_manager.message_manager)
            }

        }).catch(e => {
            console.error(e, e.stack);
        });
    }

    else if (event.itemStack.typeId === MinecraftItemTypes.Paper && !game_manager.game_running) {
        const form = new ActionFormData();
        form.title('UHC Manager')
        form.button('Settings', 'textures/ui/icon_setting')
        form.button('Start Game', 'textures/ui/dressing_room_skins')

        // @ts-ignore
        form.show(event.source).then(r => {
            // This will stop the code when the player closes the form
            if (r.canceled) return;

            let response = r.selection;
            switch (response) {
                case 0:
                    console.log()
                    break;

                case 1:
                    const confirm_start_form = new MessageFormData()
                    confirm_start_form.title('Are you sure?')
                    confirm_start_form.body(
                        'Pressing start will begin a 30 second countdown, ' +
                        'after which each team will be teleported and the UHC begins.\n\n' +
                        "Once the game starts, you §l§4can't§r:\n" +
                        "- Stop the game\n" +
                        "- Have any new players join the game\n" +
                        "- Change any settings")
                    confirm_start_form.button1("I'm Sure")
                    confirm_start_form.button2("Cancel")

                    //@ts-ignore
                    confirm_start_form.show(event.source).then(r => {
                        if(r.canceled || r.selection == 1){
                            return
                        }

                        game_manager.begin_countdown_to_start()
                    })
                    break;
            }

        }).catch(e => {
            console.error(e, e.stack);
        });
    }
});