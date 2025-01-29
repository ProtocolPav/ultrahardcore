import {ActionFormData, MessageFormData, ModalFormData} from "@minecraft/server-ui";
import {GameManager} from "../game";
import {Player} from "@minecraft/server";

export function admin_form(game_manager: GameManager, player: Player) {
    const form = new ActionFormData();
    form.title('UHC Manager')
    form.button('Start Game', 'textures/ui/dressing_room_skins')
    form.button('Settings', 'textures/ui/icon_setting')

// @ts-ignore
    form.show(player).then(r => {
        // This will stop the code when the player closes the form
        if (r.canceled) return;

        let response = r.selection;
        switch (response) {
            case 0:
                confirm_start_form(game_manager, player);
                break;

            case 1:
                settings_form(game_manager, player);
                break;
        }

    }).catch(e => {
        console.error(e, e.stack);
    });
}

function confirm_start_form(game_manager: GameManager, player: Player) {
    const form = new MessageFormData()
    form.title('Are you sure?')
    form.body(
        'Pressing start will begin a 15 second countdown, ' +
        'after which each team will be teleported and the UHC begins.\n\n' +
        "Once the game starts, you §l§4can't§r:\n" +
        "- Stop the game\n" +
        "- Have any new players join the game\n" +
        "- Change any settings")
    form.button1("I'm Sure")
    form.button2("Cancel")

    //@ts-ignore
    form.show(player).then(r => {
        if (r.canceled || r.selection == 1){
            return
        }

        game_manager.begin_countdown_to_start()
    })
}

function settings_form(game_manager: GameManager, player: Player) {
    const form = new ModalFormData()
    form.title('UHC Settings')
    form.slider('Border Circular Radius', 500, 4000, 500, game_manager.settings.border_radius)
    form.slider('Max players per team', 1, 10, 1, game_manager.settings.players_per_team)
    // form.toggle('Enable random loot chests to spawn', game_manager.settings.loot_chests_enabled)
    // form.toggle('Enable centre loot chests', game_manager.settings.centre_chests_enabled)
    form.slider('Grace Period length (minutes)', 5, 60, 5, game_manager.settings.grace_period_mins)
    form.slider('Main Game length (After Grace Period)', 20, 120, 10, game_manager.settings.main_period_mins)
    form.toggle('Enable Deathmatch', game_manager.settings.deathmatch_enabled)
    form.toggle('Enable Regeneration at halftime', game_manager.settings.halftime_regeneration)
    form.submitButton('Confirm Changes')

    //@ts-ignore
    form.show(player).then(r => {
        if (r.canceled) return;

        if (r.formValues) {
            let values = r.formValues

            game_manager.settings.border_radius = Number(values[0])
            game_manager.settings.players_per_team = Number(values[1])
            // game_manager.settings.loot_chests_enabled = Boolean(values[2])
            // game_manager.settings.centre_chests_enabled = Boolean(values[3])
            game_manager.settings.grace_period_mins = Number(values[2])
            game_manager.settings.main_period_mins = Number(values[3])
            game_manager.settings.deathmatch_enabled = Boolean(values[4])
            game_manager.settings.halftime_regeneration = Boolean(values[5])

            game_manager.settings.update_settings()
        }
    })
}
