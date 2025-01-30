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

        if (game_challenge.available) {
            form.button(game_challenge.name, game_challenge.icon)
            button_indexes.push(challenge);
        }
    }

    // @ts-ignore
    form.show(player).then(r => {
        // This will stop the code when the player closes the form
        if (r.canceled || !r.selection) return;

        let response = r.selection;
        info_form(button_indexes[response], game_manager, player)

    }).catch(e => {
        console.error(e, e.stack);
    });
}

function info_form(challenge_id: string, game_manager: GameManager, player: Player) {
    const form = new MessageFormData()
    const challenge = game_manager.challenges[challenge_id];
    let challenge_info = ''

    if (challenge.type === 'player') {
        challenge_info = 'This challenge must be completed individually. Rewards will only be given to you, on the Everthorn Server.'
    } else if (challenge.type === 'team') {
        challenge_info = 'Teammates must work together to complete this challenge. If one player completes it, the entire team receives the reward on the Everthorn Server.'
    } else if (challenge.type === 'first_team') {
        challenge_info = 'Teammates must work together to complete this challenge. If one player completes it, the entire team receives the reward on the Everthorn Server. Only the first team to complete will receive the reward.'
    }
    form.title(challenge.name)
    form.body(
        `${challenge.description}\n\nReward: ${challenge.reward} (On Everthorn Server)\n\n${challenge_info}`
    )
    form.button2("Go Back")

    //@ts-ignore
    form.show(player).then(r => {
        if (r.canceled || r.selection == 0){
            challenges_form(game_manager, player)
        }
    })
}