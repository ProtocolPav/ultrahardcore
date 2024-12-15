import {ActionFormData} from "@minecraft/server-ui";
import {GameManager} from "../game";
import {Player} from "@minecraft/server";


export function team_form(game_manager: GameManager, player: Player) {
    const form = new ActionFormData();
    form.title('Select a Team')
    game_manager.teams_manager.teams.forEach(team => {
        form.button(team.get_team_name(), team.icon)
    })

    // @ts-ignore
    form.show(player).then(r => {
        if (r.canceled) return;

        let response = r.selection;

        if (response !== undefined) {
            game_manager.teams_manager.teams[response].add_player(player, game_manager.message_manager)
        }

    }).catch(e => {
        console.error(e, e.stack);
    });
}