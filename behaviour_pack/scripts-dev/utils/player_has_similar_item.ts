import {EntityComponentTypes, Player} from "@minecraft/server";

export default function player_has_item_like(player: Player, item_like: string): string[] {
    const inventory = player.getComponent(EntityComponentTypes.Inventory);
    const matches: string[] = [];

    if (inventory?.container) {
        const regex = new RegExp(item_like, 'i'); // Case-insensitive match
        const container = inventory.container;

        for (let i = 0; i < inventory.inventorySize; i++) {
            const item = container.getItem(i);
            if (item && regex.test(item.typeId) && !matches.includes(item.typeId)) {
                matches.push(item.typeId);
            }
        }
    }

    return matches;
}