import { system, EntityComponentTypes, ItemComponentTypes, Player } from "@minecraft/server";
import { MinecraftPotionEffectTypes } from "@minecraft/vanilla-data";

const INVALID_POTIONS: string[] = [
    MinecraftPotionEffectTypes.Awkward,
    MinecraftPotionEffectTypes.Mundane,
    MinecraftPotionEffectTypes.Thick,
    MinecraftPotionEffectTypes.Water
];

export default function player_has_potion(player: Player): Promise<boolean> {
    return new Promise((resolve) => {
        system.run(() => {
            const inventory = player.getComponent(EntityComponentTypes.Inventory);
            let found = false;

            if (inventory?.container) {
                for (let i = 0; i < inventory.inventorySize; i++) {
                    const potion = inventory.container.getItem(i)?.getComponent(ItemComponentTypes.Potion);
                    if (potion && !INVALID_POTIONS.includes(potion.potionEffectType.id)) {
                        found = true;
                        break;
                    }
                }
            }
            resolve(found);
        });
    });
}