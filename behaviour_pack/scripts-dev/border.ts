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

const TELEPORT_THRESHOLD = 5;

const NO_FALL_KNOCKBACK = 30;
const NO_FALL_TELEPORT  = 60;

const KNOCKBACK_VERTICAL = 0.45;

const CHUNK_SIZE          = 16;
const PARTICLE_VISIBILITY = 100;
const PARTICLE_SEGMENT    = 128;
const PARTICLE_SPAWN_Y    = 128;
const PARTICLE_INTERVAL   = 60;

const PARTICLE_NS    = "worldborder:worldborder";
const PARTICLE_EW    = "worldborder:worldborder_ew";
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

        system.runInterval(() => this.knockbackPass(), 2);
        system.runInterval(() => this.renderParticles(), PARTICLE_INTERVAL);
    }

    public checkBorder(): void {
        const half = this.settings.border_radius;

        for (const player of world.getAllPlayers()) {
            const overshoot = this.getOvershoot(player, half);

            if (overshoot > TELEPORT_THRESHOLD) {
                this.teleportInside(player, half);
                this.messageManager.send_message("Stay within the border!", "uhc.team.death.global", player);
            }
        }
    }

    private knockbackPass(): void {
        const half = this.settings.border_radius;

        for (const player of world.getAllPlayers()) {
            const overshoot = this.getOvershoot(player, half);

            if (overshoot > 0 && overshoot <= TELEPORT_THRESHOLD) {
                this.applyKnockback(player);
            }
        }
    }

    private getOvershoot(player: Player, half: number): number {
        const { x, z } = player.location;
        return Math.max(Math.abs(x), Math.abs(z)) - half;
    }

    private applyKnockback(player: Player): void {
        const { x, z } = player.location;
        const magnitude = Math.sqrt(x * x + z * z);

        const direction: VectorXZ = {
            x: magnitude > 0 ? -x / magnitude : 0,
            z: magnitude > 0 ? -z / magnitude : -1
        };

        try {
            player.applyKnockback(direction, KNOCKBACK_VERTICAL);
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
