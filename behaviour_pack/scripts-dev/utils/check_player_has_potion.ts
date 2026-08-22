import {EntityComponentTypes, EquipmentSlot, ItemComponentTypes, ItemType, Player} from "@minecraft/server";
import {MinecraftItemTypes, MinecraftPotionEffectTypes} from "@minecraft/vanilla-data";

const INVALID_POTIONS: string[] = [
    MinecraftPotionEffectTypes.Awkward,
    MinecraftPotionEffectTypes.Mundane,
    MinecraftPotionEffectTypes.Thick,
    MinecraftPotionEffectTypes.Water
]
export default function player_has_potion(player: Player) {
    const inventory = player.getComponent(EntityComponentTypes.Inventory)

    if (inventory?.container) {
        const inventory_size = inventory.inventorySize
        const inventory_container = inventory.container

        for (let i = 0; i < inventory_size; i++) {
            const potion = inventory_container.getItem(i)?.getComponent(ItemComponentTypes.Potion)

            if (potion && !INVALID_POTIONS.includes(potion.potionEffectType.id)) {
                return true
            }
        }
    }

    return false
}