import {GameManager} from "../game";
import {Player} from "@minecraft/server";
import {CustomForm, ObservableBoolean, ObservableNumber, ObservableString} from "@minecraft/server-ui";

type AdminView = 'main' | 'confirm_start' | 'settings' | 'challenge_logs';

export function admin_form(game_manager: GameManager, player: Player) {
    const s = game_manager.settings;
    const canStart = game_manager.game_status === 'waiting' || game_manager.game_status === 'finished';

    const view = new ObservableString('main', { clientWritable: false });

    // ── Settings observables ──────────────────────────────────────────────────
    const borderRadius   = new ObservableNumber(s.border_radius, { clientWritable: true });
    const playersPerTeam = new ObservableNumber(s.players_per_team, { clientWritable: true });
    const gracePeriod    = new ObservableNumber(s.grace_period_mins, { clientWritable: true });
    const mainPeriod     = new ObservableNumber(s.main_period_mins, { clientWritable: true });
    const deathmatch     = new ObservableBoolean(s.deathmatch_enabled, { clientWritable: true });
    const halftimeRegen  = new ObservableBoolean(s.halftime_regeneration, { clientWritable: true });

    const borderDescription = new ObservableString(
        `Full width: ${s.border_radius * 2} blocks (${s.border_radius} from centre to each wall).`,
        { clientWritable: false }
    );
    borderRadius.subscribe(v =>
        borderDescription.setData(`Full width: ${v * 2} blocks (${v} from centre to each wall).`)
    );

    // ── Visibility helpers ────────────────────────────────────────────────────
    const is   = (v: AdminView) => new ObservableBoolean(view.getData() === v, { clientWritable: false });
    const isNot = (v: AdminView) => new ObservableBoolean(view.getData() !== v, { clientWritable: false });

    const mainVisible         = is('main');
    const confirmVisible      = is('confirm_start');
    const settingsVisible     = is('settings');
    const logsVisible         = is('challenge_logs');

    view.subscribe(v => {
        mainVisible.setData(v === 'main');
        confirmVisible.setData(v === 'confirm_start');
        settingsVisible.setData(v === 'settings');
        logsVisible.setData(v === 'challenge_logs');
    });

    // ── Build challenge log content ───────────────────────────────────────────
    let logBody = '';
    for (const key in game_manager.challenges) {
        const challenge = game_manager.challenges[key];
        logBody += `§e${challenge.name}§r\n`;
        challenge.progress
            .slice()
            .sort((a, b) => b.progress - a.progress)
            .forEach(p => {
                const label = p.player ? p.player_name : p.team;
                logBody += `- ${label} | ${p.progress}/${p.max_progress}\n`;
            });
        logBody += '\n';
    }

    // ── Form ──────────────────────────────────────────────────────────────────
    const form = new CustomForm(player, 'UHC Manager')

        // Main
        .button('Start Game',      () => view.setData('confirm_start'), { visible: mainVisible, disabled: !canStart })
        .button('Settings',        () => view.setData('settings'),      { visible: mainVisible })
        .button('Challenge Logs',  () => view.setData('challenge_logs'),{ visible: mainVisible })

        // Confirm start
        .label("Pressing start will begin a 15 second countdown, after which each team will be teleported and the UHC begins.\n\n§cOnce started:\n§r- The game cannot be stopped\n- No new players can join", { visible: confirmVisible })
        .divider({ visible: confirmVisible })
        .button("I'm Sure", () => { game_manager.begin_countdown_to_start(); form.close(); }, { visible: confirmVisible })
        .button('Back',     () => view.setData('main'), { visible: confirmVisible })

        // Settings
        .header('World Border', { visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .slider('Border Size', borderRadius, 500, 3800, { step: 150, description: borderDescription, visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .header('Teams', { visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .slider('Team Size', playersPerTeam, 1, 8, { step: 1, visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .header('Game Timer', { visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .slider('Grace Period', gracePeriod, 5, 60, { step: 5, description: '(in minutes)', visible: settingsVisible })
        .slider('Main Game', mainPeriod, 20, 120, { step: 10, description: '(in minutes)', visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .header('Modifiers', { visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .toggle('Enable Deathmatch', deathmatch, { description: 'The border shrinks to 100 blocks and all surviving players are teleported to the centre for a final fight.', visible: settingsVisible })
        .toggle('Enable Halftime Regeneration', halftimeRegen, { description: 'Gives 30 seconds of Regeneration', visible: settingsVisible })
        .spacer({ visible: settingsVisible })
        .button('Save Changes', () => {
            s.border_radius         = borderRadius.getData();
            s.players_per_team      = playersPerTeam.getData();
            s.grace_period_mins     = gracePeriod.getData();
            s.main_period_mins      = mainPeriod.getData();
            s.deathmatch_enabled    = deathmatch.getData();
            s.halftime_regeneration = halftimeRegen.getData();
            s.update_settings();
            view.setData('main');
        }, { visible: settingsVisible })
        .button('Back', () => view.setData('main'), { visible: settingsVisible })

        // Challenge logs
        .label(logBody || '§7No challenge data yet.', { visible: logsVisible })
        .divider({ visible: logsVisible })
        .button('Back', () => view.setData('main'), { visible: logsVisible });

    form.show().catch(e => console.error(e, e.stack));
}