import type { Id } from "../_generated/dataModel"
import type { SIDEBAR_ITEM_TYPES, SidebarItem } from "../sidebarItems/types"


export type File = SidebarItem<typeof SIDEBAR_ITEM_TYPES.files> & {
    storageId: Id<'_storage'>
}