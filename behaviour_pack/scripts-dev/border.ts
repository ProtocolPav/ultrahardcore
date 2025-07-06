import { Dimension, Player, system } from "@minecraft/server";
import { MessageManager } from "./messagebar";

export class BorderManager {
    private borderBlocks: Set<string> = new Set();
    private messageManager: MessageManager;
    private borderRadius: number;

    constructor(messageManager: MessageManager, initialRadius: number = 1500) {
        this.messageManager = messageManager;
        this.borderRadius = initialRadius;
    }

    public enforceBorder(players: Player[]): void {
        players.forEach((player) => {
            const distance = Math.sqrt(player.location.x ** 2 + player.location.z ** 2);

            // Place border blocks when players get close (large range so they see it from far away)
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
    }

    private placeBorderBlocks(player: Player): void {
        system.runJob(this.placeBorderJob(player));
    }

    private *placeBorderJob(player: Player): Generator<void, void, void> {
        const playerX = Math.floor(player.location.x);
        const playerZ = Math.floor(player.location.z);
        let processed = 0;

        // Check blocks around player
        for (let x = playerX - 32; x <= playerX + 32; x++) {
            for (let z = playerZ - 32; z <= playerZ + 32; z++) {
                const distance = Math.sqrt(x * x + z * z);

                // Place blocks exactly at border radius (1 block thick)
                if (Math.round(distance) === this.borderRadius) {
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
                // Yield every 10 blocks to prevent watchdog
                if (processed % 10 === 0) {
                    yield;
                }
            }
        }
    }
}
