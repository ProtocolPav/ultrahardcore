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

// Particle billboard is 8 blocks wide × 192 blocks tall (full world height).
// One emitter per strip at a fixed Y is all that is needed.
const PARTICLE_WIDTH      = 8;
const PARTICLE_VISIBILITY = 20;  // blocks from the wall face
const PARTICLE_SEGMENT    = 32;  // blocks either side of player along the wall
const PARTICLE_SPAWN_Y    = 128;

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

        // Particles on their own interval, decoupled from enforcement.
        system.runInterval(() => this.renderParticlesForAllPlayers(), 5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Called from the game loop (every 20 ticks).
     * Only handles the teleport fallback for players who are deeply outside.
     * Knockback is handled independently on a 2-tick interval.
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

            // Only apply knockback within the recoverable range.
            // Players beyond TELEPORT_OVERSHOOT_THRESHOLD are handled by checkBorder().
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

        // Direction points from the player back toward the centre (0, 0).
        // If the player is exactly at the origin, push them north.
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

        // Absolute distance from the player to each wall face.
        // Using Math.abs ensures this is always positive regardless of which
        // side of the border the player is on, so only truly nearby walls render.
        const distToEast  = Math.abs( half - x);
        const distToWest  = Math.abs(-half - x);
        const distToSouth = Math.abs( half - z);
        const distToNorth = Math.abs(-half - z);

        if (distToEast  <= PARTICLE_VISIBILITY) this.spawnWallStrip(player,  half, z, "xFixed", PARTICLE_NS, molang);
        if (distToWest  <= PARTICLE_VISIBILITY) this.spawnWallStrip(player, -half, z, "xFixed", PARTICLE_NS, molang);
        if (distToSouth <= PARTICLE_VISIBILITY) this.spawnWallStrip(player,  half, x, "zFixed", PARTICLE_EW, molang);
        if (distToNorth <= PARTICLE_VISIBILITY) this.spawnWallStrip(player, -half, x, "zFixed", PARTICLE_EW, molang);
    }

    /**
     * Spawns a horizontal strip of particles along one wall face.
     * Each billboard is PARTICLE_WIDTH wide and 192 blocks tall, so one emitter
     * per strip covers the full world height with no vertical loop needed.
     * Strip origins are snapped to a PARTICLE_WIDTH-aligned grid for seamless tiling.
     */
    private spawnWallStrip(
        player: Player,
        wallFixed: number,
        playerAlong: number,
        axis: "xFixed" | "zFixed",
        particleId: string,
        molang: MolangVariableMap
    ): void {
        const snappedCenter = Math.floor(playerAlong / PARTICLE_WIDTH) * PARTICLE_WIDTH;
        const strips = Math.ceil(PARTICLE_SEGMENT / PARTICLE_WIDTH);

        for (let i = -strips; i <= strips; i++) {
            const along = snappedCenter + i * PARTICLE_WIDTH;

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
