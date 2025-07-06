import { Dimension, Player, system } from "@minecraft/server";
import { MessageManager } from "./messagebar";

export class BorderManager {
    private borderBlocks: Set<string> = new Set();
    private messageManager: MessageManager;
    private borderRadius: number;
    private activeJobs: Set<string> = new Set(); // Prevent duplicate jobs

    constructor(messageManager: MessageManager, initialRadius: number = 1500) {
        this.messageManager = messageManager;
        this.borderRadius = initialRadius;
    }

    public enforceBorder(players: Player[]): void {
        players.forEach((player) => {
            const distance = Math.sqrt(player.location.x ** 2 + player.location.z ** 2);

            // Place border blocks when players get close
            if (distance > this.borderRadius - 32) {
                this.placeBorderBlocks(player);
            }

            // Teleport player back if they cross the border
            if (distance > this.borderRadius) {
                const angle = Math.atan2(player.location.z, player.location.x);
                player.teleport({
                    x: (this.borderRadius - 1) * Math.cos(angle),
                    y: player.location.y,
                    z: (this.borderRadius - 1) * Math.sin(angle)
                });
                this.messageManager.send_message("Stay within the border", 'uhc.team.death.global', player);
            }
        });
    }

    public updateRadius(newRadius: number): void {
        this.borderRadius = newRadius;
        this.borderBlocks.clear();
        this.activeJobs.clear(); // Clear jobs when radius changes
    }

    private placeBorderBlocks(player: Player): void {
        const playerKey = `${Math.floor(player.location.x / 32)},${Math.floor(player.location.z / 32)}`;

        // Prevent multiple jobs for the same area
        if (this.activeJobs.has(playerKey)) {
            return;
        }

        this.activeJobs.add(playerKey);
        system.runJob(this.placeBorderJob(player, playerKey));
    }

    private *placeBorderJob(player: Player, playerKey: string): Generator<void, void, void> {
        const playerX = Math.floor(player.location.x);
        const playerZ = Math.floor(player.location.z);
        let processed = 0;

        try {
            // Pre-calculate border bounds for efficiency
            const minRadius = this.borderRadius - 0.5;
            const maxRadius = this.borderRadius + 0.5;

            // Only scan coordinates that could contain border blocks
            const scanMin = Math.max(-this.borderRadius - 1, playerX - 32);
            const scanMax = Math.min(this.borderRadius + 1, playerX + 32);
            const scanMinZ = Math.max(-this.borderRadius - 1, playerZ - 32);
            const scanMaxZ = Math.min(this.borderRadius + 1, playerZ + 32);

            for (let x = scanMin; x <= scanMax; x++) {
                for (let z = scanMinZ; z <= scanMaxZ; z++) {
                    const distance = Math.sqrt(x * x + z * z);

                    // More precise border check - within 0.5 blocks of exact radius
                    if (distance >= minRadius && distance <= maxRadius) {
                        const blockKey = `${x},${z}`;

                        if (!this.borderBlocks.has(blockKey)) {
                            // Place full height wall from bedrock to y128
                            for (let y = -64; y <= 128; y++) {
                                try {
                                    player.dimension.setBlockType({ x, y, z }, 'minecraft:glass');
                                } catch (error) {
                                    // Ignore errors for unloaded chunks
                                }
                            }
                            this.borderBlocks.add(blockKey);
                        }
                    }

                    processed++;
                    // Yield every 20 blocks for better performance
                    if (processed % 20 === 0) {
                        yield;
                    }
                }
            }
        } finally {
            // Always clean up the job tracking
            this.activeJobs.delete(playerKey);
        }
    }
}
