import {Settings} from "./settings";
import {MessageManager} from "./messagebar";
import {
    EntityDamageCause,
    MolangVariableMap,
    Player,
    system,
    Vector3,
    VectorXZ,
    world
} from "@minecraft/server";

// How many blocks past the wall before knockback is skipped and the player
// is teleported directly. Beyond this threshold knockback can't recover them.
const TELEPORT_OVERSHOOT_THRESHOLD = 5;

// Ticks of fall-damage immunity after knockback or teleport.
const NO_FALL_TICKS_KNOCKBACK = 30;  // ~1.5 s
const NO_FALL_TICKS_TELEPORT  = 60;  // ~3 s

// Knockback applied when the player crosses the wall.
const KNOCKBACK_HORIZONTAL = 1.8;
const KNOCKBACK_VERTICAL   = 0.45;

// Warn the player when this many blocks from the wall.
const WARNING_DISTANCE = 15;

// Particles are chunk-aligned. Each billboard is 8 blocks wide × 192 tall.
// We step one chunk (16 blocks) between emitters and spawn at the chunk centre
// (+8), which gives a 50% overlap between adjacent billboards — seamless wall.
const CHUNK_SIZE          = 16;
const PARTICLE_VISIBILITY = 100;   // blocks from the wall face
const PARTICLE_SEGMENT    = 128;   // blocks either side of the player along the wall
const PARTICLE_SPAWN_Y    = 128;

// Interval must match or exceed particle max_lifetime (3 s = 60 ticks) to
// avoid stacking multiple generations of particles on the same positions.
const PARTICLE_INTERVAL = 60;

const PARTICLE_NS    = "worldborder:worldborder";     // N/S walls (fixed X)
const PARTICLE_EW    = "worldborder:worldborder_ew";  // E/W walls (fixed Z)
const PARTICLE_COLOR = { red: 1.0, green: 0.2, blue: 0.2, alpha: 1.0 };

export class BorderManager {
    private readonly settings: Settings;
    private readonly messageManager: MessageManager;

    private readonly noFallUntil = new Map<string, number>();

    constructor(settings: Settings, messageManager: MessageManager) {
        this.settings = settings;
        this.messageManager = messageManager;

        // Cancel fall damage for protected players.
        world.beforeEvents.entityHurt.subscribe(
            (event) => {
                const entity = event.hurtEntity;
                if (entity.typeId !== "minecraft:player") return;
                const expiresAt = this.noFallUntil.get(entity.id);
                if (expiresAt !== undefined && system.currentTick <= expiresAt) {
                    event.cancel = true;
                }
            },
            { allowedDamageCauses: [EntityDamageCause.fall] }
        );

        // Knockback runs on a fast interval so it feels immediate.
        // Teleport fallback runs via checkBorder() in the game loop.
        system.runInterval(() => this.runKnockbackPass(), 2);

        // Particle interval matches particle lifetime so exactly one generation
        // of particles is alive at any time — no stacking, no double wall.
        system.runInterval(() => this.renderParticlesForAllPlayers(), PARTICLE_INTERVAL);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Called from the game loop (every 20 ticks).
     * Only handles the teleport fallback for players deeply outside the border.
     * Knockback is handled on its own 2-tick interval.
     */
    public checkBorder(): void {
        const half = this.settings.border_radius;

        for (const player of world.getAllPlayers()) {
            const { x, z } = player.location;
            const overshoot = Math.max(Math.abs(x), Math.abs(z)) - half;

            if (overshoot > TELEPORT_OVERSHOOT_THRESHOLD) {
                this.teleportPlayerInside(player, half);
                this.messageManager.send_message("Stay within the border!", "uhc.team.death.global", player);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Knockback pass (2-tick interval)
    // ─────────────────────────────────────────────────────────────────────────

    private runKnockbackPass(): void {
        const half = this.settings.border_radius;

        for (const player of world.getAllPlayers()) {
            const { x, z } = player.location;
            const overshoot = Math.max(Math.abs(x), Math.abs(z)) - half;

            if (overshoot <= 0) {
                if (overshoot > -WARNING_DISTANCE) {
                    const dist = Math.floor(-overshoot);
                    player.onScreenDisplay.setActionBar(
                        `§eApproaching border — §c${dist} block${dist === 1 ? "" : "s"}§e remaining`
                    );
                }
                continue;
            }

            // Deeply outside players are handled by checkBorder() via teleport.
            if (overshoot <= TELEPORT_OVERSHOOT_THRESHOLD) {
                this.applyKnockback(player);
                player.onScreenDisplay.setActionBar("§cYou hit the world border!");
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Knockback
    // ─────────────────────────────────────────────────────────────────────────

    private applyKnockback(player: Player): void {
        const { x, z } = player.location;
        const magnitude = Math.sqrt(x * x + z * z);

        const dirX = magnitude > 0 ? -x / magnitude : 0;
        const dirZ = magnitude > 0 ? -z / magnitude : -1;

        const direction: VectorXZ = { x: dirX, z: dirZ };

        try {
            player.applyKnockback(direction, KNOCKBACK_VERTICAL);
            this.grantNoFall(player.id, NO_FALL_TICKS_KNOCKBACK);
        } catch {
            // Player may be in an invalid state (e.g. dying); silently ignore.
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Teleport fallback
    // ─────────────────────────────────────────────────────────────────────────

    private teleportPlayerInside(player: Player, half: number): void {
        const { x, y, z } = player.location;

        const safeX = Math.max(-(half - 1), Math.min(half - 1, x));
        const safeZ = Math.max(-(half - 1), Math.min(half - 1, z));

        try {
            player.teleport({ x: safeX, y, z: safeZ });
            this.grantNoFall(player.id, NO_FALL_TICKS_TELEPORT);
            player.onScreenDisplay.setActionBar("§cYou hit the world border!");
        } catch {
            // Silently ignore; will retry on next game loop tick.
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fall-damage immunity
    // ─────────────────────────────────────────────────────────────────────────

    private grantNoFall(playerId: string, ticks: number): void {
        this.noFallUntil.set(playerId, system.currentTick + ticks);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Particle wall
    // ─────────────────────────────────────────────────────────────────────────

    private renderParticlesForAllPlayers(): void {
        const half = this.settings.border_radius;
        const molang = new MolangVariableMap();
        molang.setColorRGBA("variable.color", PARTICLE_COLOR);

        for (const player of world.getAllPlayers()) {
            this.renderParticlesForPlayer(player, half, molang);
        }
    }

    private renderParticlesForPlayer(player: Player, half: number, molang: MolangVariableMap): void {
        const { x, z } = player.location;

        // Snap the player position to the chunk grid for stable, seamless tiling.
        const playerChunkX = Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE;
        const playerChunkZ = Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE;

        // Absolute distance to each wall face — works correctly from both sides.
        const distToEast  = Math.abs( half - x);
        const distToWest  = Math.abs(-half - x);
        const distToSouth = Math.abs( half - z);
        const distToNorth = Math.abs(-half - z);

        // N/S walls (fixed X) → strip runs along Z axis
        if (distToEast  <= PARTICLE_VISIBILITY) this.spawnWallChunks(player,  half, playerChunkZ, "xFixed", PARTICLE_NS, molang);
        if (distToWest  <= PARTICLE_VISIBILITY) this.spawnWallChunks(player, -half, playerChunkZ, "xFixed", PARTICLE_NS, molang);

        // E/W walls (fixed Z) → strip runs along X axis
        if (distToSouth <= PARTICLE_VISIBILITY) this.spawnWallChunks(player,  half, playerChunkX, "zFixed", PARTICLE_EW, molang);
        if (distToNorth <= PARTICLE_VISIBILITY) this.spawnWallChunks(player, -half, playerChunkX, "zFixed", PARTICLE_EW, molang);
    }

    /**
     * Spawns chunk-aligned particles along one wall face.
     *
     * Iterates in CHUNK_SIZE (16-block) steps and places each emitter at the
     * chunk centre (+8). The billboard is 8 blocks wide, so adjacent emitters
     * overlap by 50% — giving a seamless, single-thickness wall.
     *
     * @param wallFixed        Fixed coordinate of this wall face.
     * @param playerChunkAlong Player’s chunk-snapped coordinate along the wall.
     * @param axis             "xFixed" → N/S wall, "zFixed" → E/W wall.
     * @param particleId       NS or EW particle variant.
     */
    private spawnWallChunks(
        player: Player,
        wallFixed: number,
        playerChunkAlong: number,
        axis: "xFixed" | "zFixed",
        particleId: string,
        molang: MolangVariableMap
    ): void {
        const min = playerChunkAlong - PARTICLE_SEGMENT;
        const max = playerChunkAlong + PARTICLE_SEGMENT;

        for (let chunk = min; chunk <= max; chunk += CHUNK_SIZE) {
            // Centre of this chunk strip.
            const along = chunk + (CHUNK_SIZE / 2);

            const pos: Vector3 = axis === "xFixed"
                ? { x: wallFixed, y: PARTICLE_SPAWN_Y, z: along }
                : { x: along,     y: PARTICLE_SPAWN_Y, z: wallFixed };

            try {
                player.spawnParticle(particleId, pos, molang);
            } catch {
                // Chunk not loaded; skip silently.
            }
        }
    }
}
