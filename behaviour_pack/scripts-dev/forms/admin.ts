import {
    CustomForm,
    ObservableNumber,
    ObservableBoolean,
    ObservableString
} from "@minecraft/server-ui";
import {GameManager} from "../game";
import {Player, system} from "@minecraft/server";

export function admin_form(game_manager: GameManager, player: Player) {
    const canStart = game_manager.game_status === 'waiting' || game_manager.game_status === 'finished';

    const form = new CustomForm(player, 'UHC Manager')
        .button('Start Game', () => {
            form.close();
            system.runTimeout(() => {confirm_start_form(game_manager, player)}, 15)
        }, { disabled: !canStart })
        .button('Settings', () => {
            form.close();
            system.runTimeout(() => {settings_form(game_manager, player)}, 15)
        })
        .button('Challenge Logs', () => {
            form.close();
            system.runTimeout(() => {challenge_logs_form(game_manager, player)}, 15)
        });

    form.show().catch(e => console.error(e, e.stack));
}

function confirm_start_form(game_manager: GameManager, player: Player) {
    const form = new CustomForm(player, 'Are you sure?')
        .label(
            'Pressing start will begin a 15 second countdown, ' +
            'after which each team will be teleported and the UHC begins.\n\n' +
            "Once the game starts, you §4can't§r:\n" +
            "- Stop the game\n" +
            "- Have any new players join the game"
        )
        .divider()
        .button("I'm Sure", () => {
            game_manager.begin_countdown_to_start();
            form.close();
        })

    form.show().catch(e => console.error(e, e.stack));
}

function settings_form(game_manager: GameManager, player: Player) {
    const s = game_manager.settings;

    const borderRadius = new ObservableNumber(s.border_radius, { clientWritable: true });
    const playersPerTeam = new ObservableNumber(s.players_per_team, { clientWritable: true });
    const gracePeriod = new ObservableNumber(s.grace_period_mins, { clientWritable: true });
    const mainPeriod = new ObservableNumber(s.main_period_mins, { clientWritable: true });
    const deathmatch = new ObservableBoolean(s.deathmatch_enabled, { clientWritable: true });
    const halftimeRegen = new ObservableBoolean(s.halftime_regeneration, { clientWritable: true });

    const borderDescription = new ObservableString(
        `The half-width of the square border. Full width: ${s.border_radius * 2} blocks (${s.border_radius} from centre to each wall).`,
        { clientWritable: false }
    );

    const form = new CustomForm(player, 'UHC Settings')
        .header('World Border')
        .spacer()
        .slider('Border Size', borderRadius, 500, 3800, { step: 150, description: borderDescription })
        .spacer()
        .header('Teams')
        .spacer()
        .slider('Team Size', playersPerTeam, 1, 8, { step: 1 })
        .spacer()
        .header('Game Timer')
        .spacer()
        .slider('Grace Period', gracePeriod, 5, 60, { step: 5, description: "How long the Grace Period lasts in minutes." })
        .slider('Main Game', mainPeriod, 20, 120, { step: 10, description: "How long the Main Game lasts in minutes." })
        .spacer()
        .header('Modifiers')
        .spacer()
        .toggle('Enable Deathmatch', deathmatch, { description: "Border Size decreased to 100, remaining players are teleported to the centre, and fight to the death." })
        .toggle('Regeneration at halftime', halftimeRegen)
        .spacer()
        .button('Save Changes', () => {
            s.border_radius         = borderRadius.getData();
            s.players_per_team      = playersPerTeam.getData();
            s.grace_period_mins     = gracePeriod.getData();
            s.main_period_mins      = mainPeriod.getData();
            s.deathmatch_enabled    = deathmatch.getData();
            s.halftime_regeneration = halftimeRegen.getData();
            s.update_settings();
            form.close();
        });

    form.show().catch(e => console.error(e, e.stack));
}

function challenge_logs_form(game_manager: GameManager, player: Player) {
    const form = new CustomForm(player, 'Challenge Logs');

    if (Object.keys(game_manager.challenges).length === 0) {
        form.label('§7No challenge data yet.');
    }

    for (const key in game_manager.challenges) {
        const challenge = game_manager.challenges[key];
        form.label(`§e${challenge.name}§r`);

        challenge.progress
            .slice()
            .sort((a, b) => b.progress - a.progress)
            .forEach(p => {
                const label = p.player ? p.player.name : p.team;
                form.label(`- ${label} | ${p.progress}/${p.max_progress}`);
            });

        form.divider();
    }

    form.button('Exit', () => form.close());

    form.show().catch(e => console.error(e, e.stack));
}
