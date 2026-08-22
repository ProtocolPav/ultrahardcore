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
    // Tiny Challenges
    visit_challenge: new Challenge(
        'Shaken, Not Stirred',
        'Your journey will surely not be easy. Visit the centre of the world, at [0, 0]',
        'textures/items/compass_item.png',
        '16 Stacks of Logs',
        'player',
        1
    ),
    tame_challenge: new Challenge(
        'Best Friend',
        "They say a player's best friend is a dog. So go tame one!",
        'textures/items/bone.png',
        'Wolf Spawn Egg',
        'player',
        1
    ),
    halftime_challenge: new Challenge(
        'Where are the Cheerleaders?',
        'If you really think you are a master of the UHC, try surviving until halftime',
        'textures/items/clock_item.png',
        '1 Nug',
        'player',
        1
    ),
    boat_challenge: new Challenge(
        'Land Ho',
        'A true sailor knows their way round. Travel 200 blocks on a boat.',
        'textures/items/boat_oak.png',
        '20 Sponges',
        'player',
        200
    ),
    kill_challenge: new Challenge(
        'KDR',
        'They say you should aim for a Kill-to-Death ratio of 2. So do that. Kill 2 Players.',
        'textures/items/copper_sword.png',
        'Ravager Spawn Egg',
        'player',
        2
    ),
    spear_challenge: new Challenge(
        'Remarkable Sparkle',
        "Let's make this fun. Craft a Diamond Spear.",
        'textures/items/spear/diamond_spear.png',
        '512 of Crying Obsidian and Gilded Blackstone',
        'player',
        1
    ),

    // Medium Challenges
    hoe_challenge: new Challenge(
        'Priority Hoe',
        'The biggest waste of materials ever. Craft 1 Diamond Hoe.',
        'textures/items/diamond_hoe.png',
        '512 Mud',
        'team',
        1
    ),
    amethyst_challenge: new Challenge(
        'Purple Rain',
        'Can you find one in time? Break one Amethyst Bud.',
        'textures/items/amethyst_shard.png',
        '3 Budding Amethyst',
        'team',
        1
    ),
    villager_challenge: new Challenge(
        'View To Kill',
        "If you can't kill a player, you can definitely kill a villager.",
        'textures/items/emerald.png',
        '3 Enchanted Books of your choice',
        'team',
        1
    ),
    gapple_challenge: new Challenge(
        'Snapple Apple',
        'Craft 3 Golden Apples. It is that simple.',
        'textures/items/apple_golden.png',
        '1 Enchanted Golden Apple',
        'team',
        3
    ),

    // XXL Challenges
    iron_armour_challenge: new Challenge(
        'Avengers, Assemble!',
        'Get one full set of iron armour. That is: a helmet, chestplate, leggings, boots, and a shield!',
        'textures/items/iron_chestplate.png',
        'Team Coloured Helmet',
        'first_team',
        1
    ),
    brewing_challenge: new Challenge(
        'Quick Brew',
        'Craft a Brewing Stand',
        'textures/items/potion_bottle_heal.png',
        'Totem of Togetherness',
        'first_team',
        1
    ),
    baby_challenge: new Challenge(
        'Hit Me Baby One More Time',
        'Use a Golden Dandelion on a Hot, Temperate, and Cold Baby!',
        'textures/blocks/golden_dandelion.png',
        '6 Nugs',
        'first_team',
        3
    )
}