import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { DndContext } from '~/features/dnd/utils/dnd-registry'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'

export interface DndMonitorCtx {
  itemsMap: ReadonlyMap<SidebarItemId, AnySidebarItem>
  trashedItemsMap: ReadonlyMap<SidebarItemId, AnySidebarItem>
  getAncestorIds: (id: SidebarItemId) => Array<Id<'sidebarItems'>>
  dndContext: DndContext
  handleDropFiles: (
    dropResult: DropResult,
    options?: { parentId: Id<'sidebarItems'> | null },
  ) => Promise<void>
  campaignId: Id<'campaigns'> | null
}
