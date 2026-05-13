import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'
import type { FileSystemGlobalDropCommand } from '~/features/filesystem/filesystem-drop-planner'

export interface DndExecutionContext {
  executeFileSystemDropCommand: (command: FileSystemGlobalDropCommand) => Promise<void>
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
