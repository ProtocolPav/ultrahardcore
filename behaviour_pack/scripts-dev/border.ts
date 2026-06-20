import {Settings} from "./settings";
import {MessageManager} from "./messagebar";
import {
    EntityDamageCause,
    MolangVariableMap,
    Player,
    system,
    Vector3,
    world
} from "@minecraft/server";

// How many blocks past the wall before we skip knockback and teleport directly.
const TELEPORT_OVERSHOOT_THRESHOLD = 5;

// Ticks of fall-damage immunity granted after a knockback or forced teleport.
const NO_FALL_TICKS_KNOCKBACK = 30;  // ~1.5 s
const NO_FALL_TICKS_TELEPORT  = 60;  // ~3 s

// Knockback strengths.
const KNOCKBACK_HORIZONTAL = 1.2;
const KNOCKBACK_VERTICAL   = 0.35;

// Warning zone: show actionbar when this many blocks from the wall.
const WARNING_DISTANCE = 15;

// Each particle billboard is 8 blocks wide and 192 blocks tall (full world height).
// One emitter per strip is all that is needed — no vertical loop required.
const PARTICLE_WIDTH      = 8;   // matches the "size": [8, 192] in the particle JSON
const PARTICLE_VISIBILITY = 20;  // blocks from the wall before we start rendering
const PARTICLE_SEGMENT    = 32;  // blocks either side of the player along the wall

// Y at which emitters are placed. The particle is 192 blocks tall so it covers
// the full build height regardless of where vertically it is spawned.
const PARTICLE_SPAWN_Y = 128;

// worldborder:worldborder  — N/S walls (fixed X, billboard faces along X)
// worldborder:worldborder_ew — E/W walls (fixed Z, billboard faces along Z)
const PARTICLE_NS = "worldborder:worldborder";
const PARTICLE_EW = "worldborder:worldborder_ew";

// Border colour: red tint, full opacity.
const PARTICLE_COLOR = { red: 1.0, green: 0.2, blue: 0.2, alpha: 1.0 };

export class BorderManager {
    private readonly settings: Settings;
    private readonly messageManager: MessageManager;

    // Maps player.id → tick at which fall-damage immunity expires.
    private readonly noFallUntil = new Map<string, number>();

    constructor(settings: Settings, messageManager: MessageManager) {
        this.settings = settings;
        this.messageManager = messageManager;

        // Cancel fall damage for any player who is currently protected.
        // This listener persists for the lifetime of the add-on.
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

        // Particle rendering runs on its own interval, decoupled from the game loop.
        system.runInterval(() => this.renderParticlesForAllPlayers(), 5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /** Called every game-loop tick while the game is running. */
    public checkBorder(): void {
        const half = this.settings.border_radius;

        for (const player of world.getAllPlayers()) {
            this.enforcePlayerBorder(player, half);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Enforcement
    // ─────────────────────────────────────────────────────────────────────────

    private enforcePlayerBorder(player: Player, half: number): void {
        const { x, z } = player.location;

        // Chebyshev distance: positive = outside, negative = inside.
        const overshoot = Math.max(Math.abs(x), Math.abs(z)) - half;

        if (overshoot > 0) {
            this.handleOutsideBorder(player, half, overshoot);
        } else if (overshoot > -WARNING_DISTANCE) {
            const distanceToWall = Math.floor(-overshoot);
            player.onScreenDisplay.setActionBar(
                `§eApproaching border — §c${distanceToWall} block${distanceToWall === 1 ? "" : "s"}§e remaining`
            );
        }
    }

    private handleOutsideBorder(player: Player, half: number, overshoot: number): void {
        if (overshoot > TELEPORT_OVERSHOOT_THRESHOLD) {
            this.teleportPlayerInside(player, half);
            this.messageManager.send_message("Stay within the border!", "uhc.team.death.global", player);
        } else {
            this.applyKnockback(player);
            player.onScreenDisplay.setActionBar("§cYou hit the world border!");
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

        try {
            player.applyKnockback(dirX, dirZ, KNOCKBACK_HORIZONTAL, KNOCKBACK_VERTICAL);
            this.grantNoFall(player.id, NO_FALL_TICKS_KNOCKBACK);
        } catch {
            // Player may be in an invalid state (e.g. dead); silently ignore.
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
            // Silently ignore; will retry next tick.
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

        // Signed distance from each wall face. Positive = player is inside.
        const distToEast  = half - x;
        const distToWest  = half + x;
        const distToSouth = half - z;
        const distToNorth = half + z;

        // N/S walls (fixed X) → strip runs along Z, use worldborder:worldborder
        if (distToEast  <= PARTICLE_VISIBILITY) this.spawnWallStrip(player,  half, z, "xFixed", PARTICLE_NS, molang);
        if (distToWest  <= PARTICLE_VISIBILITY) this.spawnWallStrip(player, -half, z, "xFixed", PARTICLE_NS, molang);

        // E/W walls (fixed Z) → strip runs along X, use worldborder:worldborder_ew
        if (distToSouth <= PARTICLE_VISIBILITY) this.spawnWallStrip(player,  half, x, "zFixed", PARTICLE_EW, molang);
        if (distToNorth <= PARTICLE_VISIBILITY) this.spawnWallStrip(player, -half, x, "zFixed", PARTICLE_EW, molang);
    }

    /**
     * Spawns a horizontal strip of particles along one wall face.
     *
     * Each particle is PARTICLE_WIDTH blocks wide and covers the full world
     * height, so only one emitter per strip position is needed — no Y loop.
     * Positions are snapped to a PARTICLE_WIDTH grid so tiles are seamless
     * regardless of where along the wall the player is standing.
     *
     * @param wallFixed   Fixed coordinate of this wall face (+half or -half).
     * @param playerAlong Player’s coordinate along the wall’s parallel axis.
     * @param axis        "xFixed" → N/S wall (fixed X), "zFixed" → E/W wall (fixed Z).
     * @param particleId  NS or EW particle variant.
     */
    private spawnWallStrip(
        player: Player,
        wallFixed: number,
        playerAlong: number,
        axis: "xFixed" | "zFixed",
        particleId: string,
        molang: MolangVariableMap
    ): void {
        // Snap the player’s position to the nearest strip boundary so the
        // rendered segment is always aligned to the PARTICLE_WIDTH grid.
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
