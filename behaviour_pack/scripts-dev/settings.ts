import {world} from "@minecraft/server";

export class Settings {
    border_radius: number;
    players_per_team: number;
    loot_chests_enabled: boolean;
    centre_chests_enabled: boolean;
    grace_period_mins: number;
    main_period_mins: number;
    deathmatch_enabled: boolean;
    halftime_regeneration: boolean;

    constructor(initialized: boolean) {
        if (!initialized) {
            this.border_radius = 1500
            this.players_per_team = 3
            this.loot_chests_enabled = true
            this.centre_chests_enabled = true
            this.grace_period_mins = 30
            this.main_period_mins = 60
            this.deathmatch_enabled = true
            this.halftime_regeneration = true

            this.update_settings()
        } else {
            this.border_radius = Number(world.getDynamicProperty('uhc:border'))
            this.players_per_team = Number(world.getDynamicProperty('uhc:players_per_team'))
            this.loot_chests_enabled = Boolean(world.getDynamicProperty('uhc:loot_chests_enabled'))
            this.centre_chests_enabled = Boolean(world.getDynamicProperty('uhc:centre_chests_enabled'))
            this.grace_period_mins = Number(world.getDynamicProperty('uhc:grace_period_mins'))
            this.main_period_mins = Number(world.getDynamicProperty('uhc:main_period_mins'))
            this.deathmatch_enabled = Boolean(world.getDynamicProperty('uhc:deathmatch_enabled'))
            this.halftime_regeneration = Boolean(world.getDynamicProperty('uhc:halftime_regeneration'))
        }
    }

    update_settings(): void {
        world.setDynamicProperty('uhc:border', this.border_radius)
        world.setDynamicProperty('uhc:players_per_team', this.players_per_team)
        world.setDynamicProperty('uhc:loot_chests_enabled', this.loot_chests_enabled)
        world.setDynamicProperty('uhc:centre_chests_enabled', this.centre_chests_enabled)
        world.setDynamicProperty('uhc:grace_period_mins', this.grace_period_mins)
        world.setDynamicProperty('uhc:main_period_mins', this.main_period_mins)
        world.setDynamicProperty('uhc:deathmatch_enabled', this.deathmatch_enabled)
        world.setDynamicProperty('uhc:halftime_regeneration', this.halftime_regeneration)
    }
}