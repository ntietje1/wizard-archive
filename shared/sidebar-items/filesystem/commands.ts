import type { CampaignMemberId, SidebarItemId } from '../../common/ids'
import type { PermissionLevel } from '../../permissions/types'
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
  setAllPlayersPermission: 'setAllPlayersPermission',
  setSidebarItemsMemberPermission: 'setSidebarItemsMemberPermission',
  clearSidebarItemsMemberPermission: 'clearSidebarItemsMemberPermission',
  setFolderInheritShares: 'setFolderInheritShares',
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

export type SetAllPlayersPermissionFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.setAllPlayersPermission
  itemIds: Array<SidebarItemId>
  permissionLevel: PermissionLevel | null
}

export type SetSidebarItemsMemberPermissionFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.setSidebarItemsMemberPermission
  itemIds: Array<SidebarItemId>
  campaignMemberId: CampaignMemberId
  permissionLevel: PermissionLevel
}

export type ClearSidebarItemsMemberPermissionFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.clearSidebarItemsMemberPermission
  itemIds: Array<SidebarItemId>
  campaignMemberId: CampaignMemberId
}

export type SetFolderInheritSharesFileSystemCommand = {
  type: typeof FILE_SYSTEM_COMMAND_TYPE.setFolderInheritShares
  folderId: SidebarItemId
  inheritShares: boolean
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
  | SetAllPlayersPermissionFileSystemCommand
  | SetSidebarItemsMemberPermissionFileSystemCommand
  | ClearSidebarItemsMemberPermissionFileSystemCommand
  | SetFolderInheritSharesFileSystemCommand

export type FileSystemOperationDecision = {
  sourceItemId: SidebarItemId
  /**
   * skip: ignore this source item and continue.
   * replace: overwrite the existing destination with the source.
   * keepBoth: keep both items, renaming the incoming item when needed.
   */
  action: 'skip' | 'replace' | 'keepBoth'
}
