import { Settings } from "./settings";
import { MessageManager } from "./messagebar";
import {
    EntityDamageCause,
    MolangVariableMap,
    Player,
    system,
    Vector3,
    VectorXZ,
    world
} from "@minecraft/server";

// How far outside the border before we give up on knockback and teleport instead.
const TELEPORT_THRESHOLD = 7;

// Ticks of fall-damage immunity granted after knockback / teleport.
const NO_FALL_KNOCKBACK = 30;
const NO_FALL_TELEPORT  = 60;

// Particle billboards are 8 blocks wide × 192 tall, spawned every CHUNK_SIZE
// blocks along the wall at chunk centre. Interval matches particle max_lifetime
// (3 s = 60 ticks) so only one generation is alive at a time.
const CHUNK_SIZE          = 16;
const PARTICLE_VISIBILITY = 100;
const PARTICLE_SEGMENT    = 128;
const PARTICLE_SPAWN_Y    = 128;

const PARTICLE_NS    = "uhc:world_border";
const PARTICLE_EW    = "uhc:world_border_ew";
const PARTICLE_COLOR = { red: 1.0, green: 0.2, blue: 0.2, alpha: 1.0 };

type WallAxis = "xFixed" | "zFixed";

export class BorderManager {
    private readonly settings: Settings;
    private readonly messageManager: MessageManager;
    private readonly noFallUntil = new Map<string, number>();

    constructor(settings: Settings, messageManager: MessageManager) {
        this.settings = settings;
        this.messageManager = messageManager;

        world.beforeEvents.entityHurt.subscribe(
            (event) => {
                if (event.hurtEntity.typeId !== "minecraft:player") return;
                const expiresAt = this.noFallUntil.get(event.hurtEntity.id);
                if (expiresAt !== undefined && system.currentTick <= expiresAt) {
                    event.cancel = true;
                }
            },
            { allowedDamageCauses: [EntityDamageCause.fall] }
        );
    }

    /** Called from the game loop. Teleports players who are too deep to recover via knockback. */
    public checkBorder(): void {
        const half = this.settings.border_radius;

        this.renderParticles()

        for (const player of world.getAllPlayers()) {
            const overshoot = this.getOvershoot(player, half);

            if (overshoot > 0 && overshoot <= TELEPORT_THRESHOLD) {
                this.applyKnockback(player, half);
            } else if (overshoot > TELEPORT_THRESHOLD) {
                this.teleportInside(player, half);
                this.messageManager.send_message("Stay within the border!", "uhc.team.death.global", player);
            }
        }
    }

    // Returns how far outside the square border the player is. Negative = inside.
    private getOvershoot(player: Player, half: number): number {
        const { x, z } = player.location;
        return Math.max(Math.abs(x), Math.abs(z)) - half;
    }

    private applyKnockback(player: Player, half: number): void {
        const { x, z } = player.location;
        const overshoot = this.getOvershoot(player, half);

        // Quadratic scaling: weak nudge near the wall, strong push when deep.
        const t = overshoot / TELEPORT_THRESHOLD;
        const strength = 1.7 + t ** 2 * 6.0;
        const vertical = 0.15 + t ** 2 * 0.35;

        const direction: VectorXZ = Math.abs(x) >= Math.abs(z)
            ? { x: x > 0 ? -strength : strength, z: 0 }
            : { x: 0, z: z > 0 ? -strength : strength };

        try {
            player.applyKnockback(direction, vertical);
            this.grantNoFall(player.id, NO_FALL_KNOCKBACK);
        } catch {
            // no-op: player may be mid-death
        }
    }

    private teleportInside(player: Player, half: number): void {
        const { x, y, z } = player.location;
        const clamp = (v: number) => Math.max(-(half - 1), Math.min(half - 1, v));

        try {
            player.teleport({ x: clamp(x), y, z: clamp(z) });
            this.grantNoFall(player.id, NO_FALL_TELEPORT);
        } catch {
            // no-op: will retry next tick
        }
    }

    private grantNoFall(playerId: string, ticks: number): void {
        this.noFallUntil.set(playerId, system.currentTick + ticks);
    }

    private renderParticles(): void {
        const half = this.settings.border_radius;
        const molang = new MolangVariableMap();
        molang.setColorRGBA("variable.color", PARTICLE_COLOR);

        for (const player of world.getAllPlayers()) {
            this.renderPlayerParticles(player, half, molang);
        }
    }

    private renderPlayerParticles(player: Player, half: number, molang: MolangVariableMap): void {
        const { x, z } = player.location;
        const chunkX = Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE;
        const chunkZ = Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE;

        if (Math.abs( half - x) <= PARTICLE_VISIBILITY) this.spawnWallChunks(player,  half, chunkZ, "xFixed", PARTICLE_NS, molang);
        if (Math.abs(-half - x) <= PARTICLE_VISIBILITY) this.spawnWallChunks(player, -half, chunkZ, "xFixed", PARTICLE_NS, molang);
        if (Math.abs( half - z) <= PARTICLE_VISIBILITY) this.spawnWallChunks(player,  half, chunkX, "zFixed", PARTICLE_EW, molang);
        if (Math.abs(-half - z) <= PARTICLE_VISIBILITY) this.spawnWallChunks(player, -half, chunkX, "zFixed", PARTICLE_EW, molang);
    }

    private spawnWallChunks(
        player: Player,
        wallFixed: number,
        playerChunkAlong: number,
        axis: WallAxis,
        particleId: string,
        molang: MolangVariableMap
    ): void {
        const min = playerChunkAlong - PARTICLE_SEGMENT;
        const max = playerChunkAlong + PARTICLE_SEGMENT;

        for (let chunk = min; chunk <= max; chunk += CHUNK_SIZE) {
            const along = chunk + CHUNK_SIZE / 2;
            const pos: Vector3 = axis === "xFixed"
                ? { x: wallFixed, y: PARTICLE_SPAWN_Y, z: along }
                : { x: along,     y: PARTICLE_SPAWN_Y, z: wallFixed };

            try {
                player.spawnParticle(particleId, pos, molang);
            } catch {
                // no-op: chunk not loaded
            }
        }
    }
}
