import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'
import type { FileSystemDropIntent } from '~/features/filesystem/useFileSystem'

export interface DndExecutionContext {
  executeFileSystemDrop: (intent: FileSystemDropIntent) => Promise<void>
  openItem: (item: AnySidebarItem) => Promise<void>
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
