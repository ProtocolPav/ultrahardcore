import {MinecraftDimensionTypes, Player, TicksPerSecond, world} from "@minecraft/server";
import {MessageManager} from "./messagebar";
import {MinecraftEffectTypes} from "@minecraft/vanilla-data";

class Team {
    private readonly string_id: string
    private readonly name: string
    private readonly colour: string
    readonly icon: string
    players: Player[] = []

    constructor(string_id: string, name: string, colour: string, icon: string) {
        this.string_id = string_id;
        this.name = name;
        this.colour = colour;
        this.icon = icon;
        this.players = [];

        world.scoreboard.getObjective('uhc:teams')?.setScore(this.get_team_name(), this.players.length)
    }

    get_team_name() {
        return `${this.colour}${this.name}§r`;
    }

    update() {
        this.players = world.getPlayers({tags: [`uhc:${this.string_id}`]})

        world.scoreboard.getObjective('uhc:teams')?.setScore(this.get_team_name(), this.players.length)
        this.players.forEach((player: Player) => {
            player.nameTag = `${this.colour}${player.name}§r`
        })
    }

    add_player(player: Player, message_manager: MessageManager) {
        let player_team_tags = player.getTags().filter((tag) => tag.startsWith('uhc:'))

        if (player_team_tags.length > 0) {
            player_team_tags.forEach(tag => player.removeTag(tag))
        }

        player.addTag(`uhc:${this.string_id}`)
        player.nameTag = `${this.colour}${player.name}§r`

        message_manager.send_message(`${player.name} has joined ${this.get_team_name()}!`, 'uhc.team.join')
    }

    remove_player(player: Player, message_manager: MessageManager) {
        player.removeTag(`uhc:${this.string_id}`)
        player.nameTag = player.name

        if (this.players.length === 1) {
            message_manager.send_message(`${this.get_team_name()} has been eliminated!`, 'uhc.team.death')
        } else {
            player.dimension.playSound('uhc.team.death.global', player.location, {volume:10000})

            this.players.forEach((player: Player) => {
                player.playSound('uhc.team.death', {volume:100})
            })
        }
    }
}

export class TeamsManager {
    teams: Team[] = []

    constructor() {
        this.teams = [
            new Team('team_red', "Team Redstone", "§m", "textures/items/redstone_dust"),
            new Team('team_orange', "Team Resin", "§6", "textures/items/resin_clump"),
            new Team('team_yellow', "Team Honeycomb", "§g", "textures/items/honeycomb"),
            new Team('team_green', "Team Turtle", "§q", "textures/items/turtle_shell_piece"),
            new Team('team_lime', "Team Emerald", "§a", "textures/items/emerald"),
            new Team('team_blue', "Team Echo", "§9", "textures/items/echo_shard"),
            new Team('team_light_blue', "Team Prismarine", "§3", "textures/items/prismarine_shard"),
            new Team('team_cyan', "Team Diamond", "§b", "textures/items/diamond"),
            new Team('team_magenta', "Team Shulker", "§5", "textures/items/shulker_shell"),
            new Team('team_purple', "Team Amethyst", "§u", "textures/items/amethyst_shard"),
            new Team('team_pink', "Team Petal", "§d", "textures/items/pink_petals"),
        ]
    }

    spread_teams(radius: number) {
        this.teams.forEach(team => {
            let r = radius * Math.sqrt(Math.random())
            let theta = Math.random() * 2 * Math.PI

            let coordinates = { x: r * Math.cos(theta), y: 0, z: r * Math.sin(theta) }

            let block = world.getDimension(MinecraftDimensionTypes.overworld).getTopmostBlock(
                {x: coordinates.x, z: coordinates.z},
            )

            if (block) coordinates.y = block.y+1

            team.players.forEach((player: Player) => {
                player.addEffect(MinecraftEffectTypes.Resistance, TicksPerSecond*60, {amplifier: 100})
                player.teleport(coordinates, {keepVelocity: false})
            })
        })
    }

    winner_check(): Team | undefined {
        let teams_alive = 0
        let winning_team: Team | undefined = undefined

        this.teams.forEach(team => {
            if (team.players.length > 0) {
                teams_alive ++
                winning_team = team
            }
        })

        if (teams_alive === 1) {
            return winning_team
        }
    }

    get_team(player: Player) {
        return this.teams.find(team => team.players.includes(player))
    }
}