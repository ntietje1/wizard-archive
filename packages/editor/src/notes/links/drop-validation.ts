import type { ResourceLocation, ResourceStatus } from '../../workspace/resource-contract'
import { isTrashedSidebarItem } from '../../workspace/items/status'

type NoteLinkDropValidationCode = 'self_link' | 'trashed_item' | 'wrong_workspace'

export function validateNoteLinkDropTarget<
  TSidebarItemId extends string,
  TWorkspaceId extends string,
>({
  noteId,
  item,
  workspaceId,
}: {
  noteId: TSidebarItemId
  item: {
    id: TSidebarItemId
    workspaceId: TWorkspaceId
    location: ResourceLocation
    status: ResourceStatus
  }
  workspaceId: TWorkspaceId | null
}): NoteLinkDropValidationCode | null {
  if (item.id === noteId) return 'self_link'
  if (isTrashedSidebarItem(item)) return 'trashed_item'
  if (workspaceId && item.workspaceId !== workspaceId) return 'wrong_workspace'
  return null
}
