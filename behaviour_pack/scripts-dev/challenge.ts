import {Player} from "@minecraft/server";

class ChallengeProgress {
    player?: Player;
    player_name?: string;
    team: string;
    progress: number;
    max_progress: number;

    constructor(team: string, max_progress: number, player?: Player,) {
        this.player = player;
        this.player_name = player?.name;
        this.team = team;
        this.progress = 0;
        this.max_progress = max_progress;
    }

    increase_progress(): boolean {
        this.progress += 1;

        return this.progress === this.max_progress;
    }
}

export class Challenge {
    readonly name: string
    readonly description: string
    readonly icon: string
    readonly reward: string
    readonly type: 'player' | 'team' | 'first_team'
    available: boolean
    progress: ChallengeProgress[]
    readonly max_progress: number

    constructor(
        name: string,
        description: string,
        icon: string,
        reward: string,
        type: 'player' | 'team' | 'first_team',
        max_progress: number,
    ) {
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.available = true
        this.progress = []
        this.reward = reward;
        this.type = type;
        this.max_progress = max_progress;
    }

    get_progress(player: Player): ChallengeProgress {
        const team = player.getTags().filter((tag) => tag.startsWith('uhc:'))[0]

        if (this.type === 'player') {
            let progress = this.progress.find((progress) => progress.player?.name === player.name);

            if (!progress) {
                progress = new ChallengeProgress(team, this.max_progress, player)
                this.progress.push(progress)
            }

            return progress
        }
        else {
            let progress = this.progress.find((progress) => progress.team === team && !progress.player);

            if (!progress) {
                progress = new ChallengeProgress(team, this.max_progress)
                this.progress.push(progress)
            }

            return progress
        }
    }

    progress_challenge(player: Player): boolean {
        if (this.available) {
            const progress = this.get_progress(player);
            const increased_progress = progress.increase_progress()

            if (increased_progress && this.type === 'first_team') {
                this.available = false
            }

            return increased_progress;
        }

        return false;
    }
}

export const game_challenges: {[index: string]: Challenge} = {
    visit_challenge: new Challenge(
        'Shaken, Not Stirred',
        'Your journey will surely not be easy. Visit the centre of the world, at [0, 0]',
        'textures/items/iron_ingot.png',
        '16 Stacks of Logs',
        'player',
        1
    ),
    tame_challenge: new Challenge(
        'Best Friend',
        "They say a player's best friend is a dog. So go tame one!",
        'textures/items/iron_ingot.png',
        'Wolf Spawn Egg',
        'player',
        1
    ),
    halftime_challenge: new Challenge(
        'Where are the Cheerleaders?',
        'If you really think you are a master of the UHC, try surviving until halftime',
        'textures/items/gold_ingot.png',
        '1 Nug',
        'player',
        1
    ),
    boat_challenge: new Challenge(
        'Land Ho',
        'A true sailor knows their way round. Travel 200 blocks on a boat.',
        'textures/items/gold_ingot.png',
        '20 Sponges',
        'player',
        200
    ),
    kill_challenge: new Challenge(
        'KDR',
        'They say you should aim for a Kill-to-Death ratio of 2. So do that. Kill 2 Players.',
        'textures/items/gold_ingot.png',
        'Ravager Spawn Egg',
        'player',
        2
    ),
    spear_challenge: new Challenge(
        'Remarkable Sparkle',
        "Let's make this fun. Craft a Diamond Spear.",
        'textures/items/gold_ingot.png',
        '512 of Crying Obsidian and Gilded Blackstone',
        'player',
        1
    ),

    jump_challenge: new Challenge(
        'Icarus',
        'Icarus once tried the impossible - flying. That ended well! You should try it too. Jump from y320 down to y-50',
        'textures/items/gold_ingot.png',
        '640 Blocks',
        'team',
        1
    ),
    halftime_challenge: new Challenge(
        'Halftime',
        'If you really think you are a master of the UHC, try surviving until halftime',
        'textures/items/gold_ingot.png',
        '15 of each Mineral Block',
        'team',
        1
    ),
    skeleton_challenge: new Challenge(
        'Die, Undead',
        'Kill the undead. Simple. Kill 15 Skeletons',
        'textures/items/gold_ingot.png',
        '+140XP Levels',
        'team',
        15
    ),
    blaze_challenge: new Challenge(
        'Blazing Through',
        'This challenge requires you going to the nether. Can you obtain a single Blaze Rod?',
        'textures/items/gold_ingot.png',
        '6 Nugs',
        'team',
        1
    ),
    wool_challenge: new Challenge(
        'Wool Collection',
        'A collectors dream... or nightmare? I dont know. Just collect all 16 colours of wool. One member of your team should hold all 16 colours at once to successfully complete this challenge.',
        'textures/items/shears.png',
        'Shulker Box',
        'first_team',
        1
    ),
    eliminate_challenge: new Challenge(
        'Back To The Lobby',
        'Send them back to the lobby! Eliminate another team.',
        'textures/items/netherite_sword.png',
        'Steve Head',
        'first_team',
        1
    ),
    mining_challenge: new Challenge(
        'Miners Delight',
        'This one needs some real focus. Mine 128 different ores. Valid ores: Gold, Diamond, Iron, Emerald, Redstone, Ancient Debris.',
        'textures/items/netherite_pickaxe.png',
        '64 of each Ore',
        'first_team',
        128
    ),
    trial_challenge: new Challenge(
        'Trialing Along',
        'Wanna go on a full-on side quest? Go and obtain an Ominous Trial Key for me. Thanks!',
        'textures/items/ominous_trial_key.png',
        'Enchanted Mace',
        'first_team',
        1
    )
}