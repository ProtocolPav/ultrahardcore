import {EntityComponentTypes, EquipmentSlot, ItemType, Player} from "@minecraft/server";

export default function player_has_item(player: Player, item_id: string) {
    const inventory = player.getComponent(EntityComponentTypes.Inventory)
    const armour = player.getComponent(EntityComponentTypes.Equippable)

    if (inventory?.container) {
        const inventory_size = inventory.inventorySize
        const inventory_container = inventory.container

        for (let i = 0; i < inventory_size; i++) {
            const item = inventory_container.getItem(i)

            if (item?.typeId === item_id) {
                return item.amount
            }
        }
    }

    if (armour?.getEquipment(EquipmentSlot.Feet)?.typeId === item_id) return true
    else if (armour?.getEquipment(EquipmentSlot.Legs)?.typeId === item_id) return true
    else if (armour?.getEquipment(EquipmentSlot.Chest)?.typeId === item_id) return true
    else if (armour?.getEquipment(EquipmentSlot.Head)?.typeId === item_id) return true
    else if (armour?.getEquipment(EquipmentSlot.Offhand)?.typeId === item_id) return true

    return false
}