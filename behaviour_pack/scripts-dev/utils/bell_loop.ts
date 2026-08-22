import { world, system, DimensionTypes } from "@minecraft/server"

const SCAN_RADIUS = 24      // horizontal blocks around each player
const SCAN_HEIGHT = 16      // blocks above/below player to check
const SPAWN_SPREAD = 3      // random offset radius for spawned mobs

export function *find_and_trigger_bell() {
    for (const player of world.getAllPlayers()) {
        const dimension = player.dimension
        const origin = player.location

        for (let x = -SCAN_RADIUS; x <= SCAN_RADIUS; x++) {
            for (let z = -SCAN_RADIUS; z <= SCAN_RADIUS; z++) {
                for (let y = -SCAN_HEIGHT; y <= SCAN_HEIGHT; y++) {
                    const pos = {
                        x: Math.floor(origin.x) + x,
                        y: Math.floor(origin.y) + y,
                        z: Math.floor(origin.z) + z
                    }

                    const block = dimension.getBlock(pos)
                    if (!block || block.typeId !== 'minecraft:bell') continue

                    const key = `bell_triggered_${dimension.id}_${pos.x}_${pos.y}_${pos.z}`
                    if (world.getDynamicProperty(key)) continue // already used

                    summon_bell_defenders(dimension, pos)
                    world.setDynamicProperty(key, true)
                    return // stop after the first eligible bell
                }
            }
            yield // hand control back to the game every row to avoid lag
        }
    }
}

function summon_bell_defenders(dimension, pos) {
    for (let i = 0; i < 9; i++) {
        dimension.spawnEntity('minecraft:villager', random_offset(pos))
    }
    for (let i = 0; i < 5; i++) {
        dimension.spawnEntity('minecraft:iron_golem', random_offset(pos))
    }
}

function random_offset(pos) {
    return {
        x: pos.x + (Math.random() * 2 - 1) * SPAWN_SPREAD,
        y: pos.y,
        z: pos.z + (Math.random() * 2 - 1) * SPAWN_SPREAD
    }
}