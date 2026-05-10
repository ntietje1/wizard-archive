import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { DropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'

export interface DndExecutionContext {
  moveItems: (items: Array<AnySidebarItem>, parentId?: Id<'sidebarItems'> | null) => Promise<void>
  restoreItems: (
    items: Array<AnySidebarItem>,
    parentId?: Id<'sidebarItems'> | null,
  ) => Promise<void>
  trashItems: (items: Array<AnySidebarItem>) => Promise<void>
  navigateToItem: (slug: SidebarItemSlug, replace?: boolean) => Promise<void>
  setFolderOpen: (folderId: Id<'sidebarItems'>) => void
}

export interface DndMonitorCtx {
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  trashedItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  getAncestorIds: (id: Id<'sidebarItems'>) => Array<Id<'sidebarItems'>>
  dndContext: DndExecutionContext
  dropPlanningContext: DropPlanningContext
  handleDropFiles: (
    dropResult: DropResult,
    options?: { parentId: Id<'sidebarItems'> | null },
  ) => Promise<void>
  campaignId: Id<'campaigns'> | null
}
