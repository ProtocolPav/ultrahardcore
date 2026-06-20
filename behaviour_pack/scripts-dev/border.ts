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
// Knockback cannot reliably push a player who is far outside, so we fall back.
const TELEPORT_OVERSHOOT_THRESHOLD = 5;

// Ticks of fall-damage immunity granted after a knockback or forced teleport.
// Knockback arcs the player upward; teleport may land them mid-air.
const NO_FALL_TICKS_KNOCKBACK  = 30;  // ~1.5 s
const NO_FALL_TICKS_TELEPORT   = 60;  // ~3 s

// Knockback strengths. Horizontal drives the player back toward centre;
// vertical gives a small arc so they don't slide along the wall.
const KNOCKBACK_HORIZONTAL = 1.2;
const KNOCKBACK_VERTICAL   = 0.35;

// Warning zone: show actionbar when this many blocks from the wall.
const WARNING_DISTANCE = 15;

// Particles: shown when the player is within this distance of any wall face.
const PARTICLE_VISIBILITY = 20;   // blocks
const PARTICLE_SEGMENT     = 30;   // blocks either side of player along the wall
const PARTICLE_STEP        = 4;    // horizontal spacing between emitters
const PARTICLE_Y_BELOW     = 2;    // blocks below player Y
const PARTICLE_Y_ABOVE     = 10;   // blocks above player Y
const PARTICLE_Y_STEP      = 2;    // vertical spacing between emitters
const PARTICLE_ID          = "minecraft:endrod_particle";

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

        // Particle rendering runs on its own faster interval so the wall
        // looks smooth without burdening the main game-loop tick.
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

        // Chebyshev distance from the square border wall.
        // Positive → outside, negative → inside.
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
            // Too deep for knockback to be effective; teleport them back.
            this.teleportPlayerInside(player, half);
            this.messageManager.send_message("Stay within the border!", "uhc.team.death.global", player);
        } else {
            // Normal case: push them back with knockback.
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

        // If the player is exactly at the origin, push them north arbitrarily.
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

        // Clamp each axis independently to keep the player as close as possible
        // to where they were (rather than snapping to the border centre-edge).
        const safeX = Math.max(-(half - 1), Math.min(half - 1, x));
        const safeZ = Math.max(-(half - 1), Math.min(half - 1, z));

        const destination: Vector3 = { x: safeX, y, z: safeZ };

        try {
            player.teleport(destination);
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

        for (const player of world.getAllPlayers()) {
            this.renderParticlesForPlayer(player, half);
        }
    }

    private renderParticlesForPlayer(player: Player, half: number): void {
        const { x, y, z } = player.location;
        const molang = new MolangVariableMap();

        // Distance to each of the four wall faces (positive = player is inside).
        const distEast  = half - x;
        const distWest  = half + x;
        const distSouth = half - z;
        const distNorth = half + z;

        if (distEast  <= PARTICLE_VISIBILITY) this.spawnWallSegment(player, y,  half, z,  "xFixed", molang);
        if (distWest  <= PARTICLE_VISIBILITY) this.spawnWallSegment(player, y, -half, z,  "xFixed", molang);
        if (distSouth <= PARTICLE_VISIBILITY) this.spawnWallSegment(player, y,  half, x,  "zFixed", molang);
        if (distNorth <= PARTICLE_VISIBILITY) this.spawnWallSegment(player, y, -half, x,  "zFixed", molang);
    }

    /**
     * Spawns a vertical slice of particles along one wall face.
     *
     * @param wallFixed   The fixed coordinate of this wall face (e.g. +half or -half).
     * @param playerAlong The player's coordinate along the wall's parallel axis.
     * @param axis        "xFixed" → wall runs N/S (fixed X), "zFixed" → wall runs E/W (fixed Z).
     */
    private spawnWallSegment(
        player: Player,
        playerY: number,
        wallFixed: number,
        playerAlong: number,
        axis: "xFixed" | "zFixed",
        molang: MolangVariableMap
    ): void {
        const minAlong = playerAlong - PARTICLE_SEGMENT;
        const maxAlong = playerAlong + PARTICLE_SEGMENT;
        const minY     = Math.floor(playerY) - PARTICLE_Y_BELOW;
        const maxY     = Math.floor(playerY) + PARTICLE_Y_ABOVE;

        for (let along = minAlong; along <= maxAlong; along += PARTICLE_STEP) {
            for (let py = minY; py <= maxY; py += PARTICLE_Y_STEP) {
                const pos: Vector3 = axis === "xFixed"
                    ? { x: wallFixed, y: py, z: along }
                    : { x: along,     y: py, z: wallFixed };

                try {
                    player.spawnParticle(PARTICLE_ID, pos, molang);
                } catch {
                    // Chunk not loaded; skip silently.
                }
            }
        }
    }
}
