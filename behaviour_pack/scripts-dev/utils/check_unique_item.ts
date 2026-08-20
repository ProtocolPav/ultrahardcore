import {EntityComponentTypes, Player} from "@minecraft/server";

export default function player_has_unique_item(player: Player, item_id: string) {
    const inventory = player.getComponent(EntityComponentTypes.Inventory)
    if (inventory?.container) {
        const inventory_size = inventory.inventorySize
        const inventory_container = inventory.container

        for (let i = 0; i < inventory_size; i++) {
            if (inventory_container.getItem(i)?.typeId === item_id) {
                const item = inventory_container.getItem(i)

                if (item?.getDynamicProperty('uhc:unique_item_parsed') !== true) {
                    item?.setDynamicProperty('uhc:unique_item_parsed', true)
                    return true
                }
            }
        }
    }

    return false
}