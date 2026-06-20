import {Settings} from "./settings";
import {MessageManager} from "./messagebar";
import {Player, system, Vector3, world} from "@minecraft/server";

export class BorderManager {
    private settings: Settings;
    private messageManager: MessageManager;
    private dimensionChangeTracker: Map<string, number>;

    // Constants mapping to the inspiration's DEFAULTS
    private readonly DIMENSION_CHANGE_GRACE_TICKS = 100; // 5 seconds grace period
    private readonly KNOCKBACK_HORIZONTAL_STRENGTH = 0.5;
    private readonly KNOCKBACK_VERTICAL_STRENGTH = 0.2;

    constructor(settings: Settings, messageManager: MessageManager) {
        this.settings = settings;
        this.messageManager = messageManager;
        this.dimensionChangeTracker = new Map<string, number>();
    }

    /**
     * Call this in an event listener (e.g., world.afterEvents.playerDimensionChange)
     * Tracks when a player switches dimensions to grant them a grace period
     * before border enforcement kicks in.
     */
    public onDimensionChange(playerId: string): void {
        this.dimensionChangeTracker.set(playerId, system.currentTick);
    }

    /**
     * Call this inside your GameManager's running loop.
     */
    public checkBorder(): void {
        const players = world.getAllPlayers();

        for (const player of players) {
            this.enforcePlayerBorder(player);
        }
    }

    private enforcePlayerBorder(player: Player): void {
        const location = player.location;
        const radius = this.settings.border_radius;

        // Calculate distance from center (0,0)
        const distance = Math.sqrt(location.x ** 2 + location.z ** 2);

        // Handle dimension change grace period
        const changeTick = this.dimensionChangeTracker.get(player.id);
        if (changeTick !== undefined) {
            if (distance <= radius) {
                // Player landed inside the border, remove grace period
                this.dimensionChangeTracker.delete(player.id);
            } else {
                const elapsed = system.currentTick - changeTick;
                if (elapsed < this.DIMENSION_CHANGE_GRACE_TICKS) {
                    const seconds = Math.ceil((this.DIMENSION_CHANGE_GRACE_TICKS - elapsed) / 20);
                    player.onScreenDisplay.setActionBar(`§eOutside border - teleporting in §c${seconds}s`);
                    return;
                }
                // Grace period expired, enforce border
                this.dimensionChangeTracker.delete(player.id);
                this.teleportPlayerInside(player, radius);
                return;
            }
        }

        if (distance > radius) {
            // Player crossed the border normally
            const warningDistance = radius - 10; // Warn when 10 blocks away

            // Apply knockback as the first defense (from inspiration)
            this.applyKnockback(player, radius);

            // Backup teleportation logic
            this.messageManager.send_message("Stay within the border!", 'uhc.team.death.global', player);
            this.teleportPlayerInside(player, radius);
        } else if (distance > (radius - 10)) {
            // Warn when approaching (from inspiration)
            const distanceToBarrier = Math.floor(radius - distance);
            player.onScreenDisplay.setActionBar(`§eApproaching border! (§c${distanceToBarrier} blocks§e)`);
        }
    }

    private applyKnockback(player: Player, radius: number): void {
        const location = player.location;

        // Calculate direction vector pointing towards origin (0,0)
        const directionX = -location.x;
        const directionZ = -location.z;

        const magnitude = Math.sqrt(directionX ** 2 + directionZ ** 2);
        if (magnitude === 0) return;

        const normalizedX = directionX / magnitude;
        const normalizedZ = directionZ / magnitude;

        const knockbackVector = {
            x: normalizedX * this.KNOCKBACK_HORIZONTAL_STRENGTH,
            z: normalizedZ * this.KNOCKBACK_HORIZONTAL_STRENGTH
        };

        try {
            player.applyKnockback(
                knockbackVector,
                this.KNOCKBACK_VERTICAL_STRENGTH,
            );
            // player.playSound('random.break', { volume: 0.5, pitch: 0.8 }); // Optional: Add sound
        } catch (error) {
            console.warn(`Failed to apply knockback to ${player.name}`);
        }
    }

    private teleportPlayerInside(player: Player, radius: number): void {
        // Your original trigonometric approach to place them safely inside
        const angle = Math.atan2(player.location.z, player.location.x);

        // Radius - 2 ensures they aren't teleported directly onto the border boundary
        const safeRadius = radius - 2;

        const tp_location: Vector3 = {
            x: safeRadius * Math.cos(angle),
            y: player.location.y,
            z: safeRadius * Math.sin(angle)
        };

        try {
            player.teleport(tp_location);
            player.onScreenDisplay.setActionBar("§cYou hit the world border!");
        } catch (error) {
            console.warn(`Failed to teleport ${player.name} inside border.`);
        }
    }
}