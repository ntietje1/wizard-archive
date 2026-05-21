import type { Id } from '../../_generated/dataModel'
import type { SidebarItemColor } from '../../../shared/sidebar-items/color'
import type { SidebarItemIconName } from '../../../shared/sidebar-items/icon'
import type { SidebarItemName } from '../../../shared/sidebar-items/name'
import type { CreateParentTarget } from '../validation/parent'
import type { SidebarItemType } from '../types/baseTypes'

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
  itemId: Id<'sidebarItems'>
  name?: SidebarItemName
  iconName?: SidebarItemIconName | null
  color?: SidebarItemColor | null
}

export type MoveFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.move
  itemIds: Array<Id<'sidebarItems'>>
  targetParentId: Id<'sidebarItems'> | null
}

export type CopyFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.copy
  itemIds: Array<Id<'sidebarItems'>>
  targetParentId: Id<'sidebarItems'> | null
}

export type TrashFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.trash
  itemIds: Array<Id<'sidebarItems'>>
}

export type RestoreFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.restore
  itemIds: Array<Id<'sidebarItems'>>
  targetParentId: Id<'sidebarItems'> | null
}

export type DeleteForeverFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.deleteForever
  itemIds: Array<Id<'sidebarItems'>>
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
  sourceItemId: Id<'sidebarItems'>
  /**
   * skip: ignore this source item and continue.
   * replace: overwrite the existing destination with the source.
   * keepBoth: keep both items, renaming the incoming item when needed.
   */
  action: 'skip' | 'replace' | 'keepBoth'
}
