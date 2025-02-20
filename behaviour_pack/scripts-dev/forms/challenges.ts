import {GameManager} from "../game";
import {Player} from "@minecraft/server";
import {ActionFormData, MessageFormData} from "@minecraft/server-ui";
import {Challenge} from "../challenge";

export function challenges_form(game_manager: GameManager, player: Player) {
    const form = new ActionFormData();
    const button_indexes: string[] = []
    form.title('UHC Challenges')
    for (let challenge in game_manager.challenges) {
        let game_challenge: Challenge = game_manager.challenges[challenge];
        let player_challenge = game_challenge.get_progress(player)
        let colour = game_manager.teams_manager.get_team(player)?.get_team_colour()

        if (game_challenge.available && player_challenge.progress <= player_challenge.max_progress) {
            form.button(
                `${game_challenge.name} ${colour ? colour : '§l'}${player_challenge.progress}/${player_challenge.max_progress}`,
                game_challenge.icon
            )
            button_indexes.push(challenge);
        }
    }

    // @ts-ignore
    form.show(player).then(r => {
        // This will stop the code when the player closes the form
        if (r.canceled || r.selection === undefined) return;

        let response = r.selection;
        info_form(button_indexes[response], game_manager, player)

    }).catch(e => {
        console.error(e, e.stack);
    });
}

function info_form(challenge_id: string, game_manager: GameManager, player: Player) {
    const form = new MessageFormData()
    const challenge = game_manager.challenges[challenge_id];
    let player_challenge = challenge.get_progress(player)
    let colour = game_manager.teams_manager.get_team(player)?.get_team_colour()
    let challenge_info = ''

    if (challenge.type === 'player') {
        challenge_info = 'This challenge must be completed individually. Rewards will only be given to you, on the Everthorn Server.'
    } else if (challenge.type === 'team') {
        challenge_info = 'Teammates must work together to complete this challenge. If one player completes it, the entire team receives the reward on the Everthorn Server.'
    } else if (challenge.type === 'first_team') {
        challenge_info = 'Teammates must work together to complete this challenge. If one player completes it, the entire team receives the reward on the Everthorn Server. Only the first team to complete will receive the reward.'
    }
    form.title(`${challenge.name} ${colour ? colour : '§l'}${player_challenge.progress}/${player_challenge.max_progress}`)
    form.body(
        `§e${challenge.description}§r\nReward: ${challenge.reward} (On Everthorn Server)\n\n§8${challenge_info}§r`
    )
    form.button1("Go Back")
    form.button2("Exit")

    //@ts-ignore
    form.show(player).then(r => {
        if (r.canceled || r.selection == 1){
            return
        }

        challenges_form(game_manager, player)
    })
}