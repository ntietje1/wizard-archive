import type { SidebarItemId } from './types'
import type { SidebarItemColor } from '../color'
import type { SidebarItemIconName } from '../icon'
import type { SidebarItemName } from '../name'
import type { CreateParentTarget } from '../parent-target'
import type { SidebarItemType } from '../types'

export const FILE_SYSTEM_COMMAND_TYPE = {
  create: 'create',
  rename: 'rename',
  move: 'move',
  copy: 'copy',
  trash: 'trash',
  restore: 'restore',
  deleteForever: 'deleteForever',
  emptyTrash: 'emptyTrash',
} as const

export type CreateFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.create
  itemType: SidebarItemType
  name: SidebarItemName
  parentTarget: CreateParentTarget
  iconName?: SidebarItemIconName
  color?: SidebarItemColor
}

export type RenameFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.rename
  itemId: SidebarItemId
  name?: SidebarItemName
  iconName?: SidebarItemIconName | null
  color?: SidebarItemColor | null
}

export type MoveFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.move
  itemIds: Array<SidebarItemId>
  targetParentId: SidebarItemId | null
}

export type CopyFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.copy
  itemIds: Array<SidebarItemId>
  targetParentId: SidebarItemId | null
}

export type TrashFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.trash
  itemIds: Array<SidebarItemId>
}

export type RestoreFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.restore
  itemIds: Array<SidebarItemId>
  targetParentId: SidebarItemId | null
}

export type DeleteForeverFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.deleteForever
  itemIds: Array<SidebarItemId>
}

export type EmptyTrashFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.emptyTrash
}

export type FileSystemCommand =
  | CreateFileSystemCommand
  | RenameFileSystemCommand
  | MoveFileSystemCommand
  | CopyFileSystemCommand
  | TrashFileSystemCommand
  | RestoreFileSystemCommand
  | DeleteForeverFileSystemCommand
  | EmptyTrashFileSystemCommand

export type FileSystemOperationDecision = {
  sourceItemId: SidebarItemId
  /**
   * skip: ignore this source item and continue.
   * replace: overwrite the existing destination with the source.
   * keepBoth: keep both items, renaming the incoming item when needed.
   */
  action: 'skip' | 'replace' | 'keepBoth'
}
