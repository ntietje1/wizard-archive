import type { ResourceStatus } from '../workspace/resource-contract'
import { isTrashedSidebarItem } from '../workspace/items/status'

type EmbedDropValidationCode = 'self_embed' | 'trashed_item' | 'wrong_workspace'

type EmbedDropItem<TSidebarItemId extends string, TWorkspaceId extends string> = {
  id: TSidebarItemId
  workspaceId: TWorkspaceId
  status: ResourceStatus
}

export function validateEmbedDropTarget<
  TSidebarItemId extends string,
  TWorkspaceId extends string,
>({
  targetId,
  item,
  workspaceId,
}: {
  targetId: TSidebarItemId
  item: EmbedDropItem<TSidebarItemId, TWorkspaceId>
  workspaceId: TWorkspaceId | null
}): EmbedDropValidationCode | null {
  if (item.id === targetId) return 'self_embed'
  if (isTrashedSidebarItem(item)) return 'trashed_item'
  if (workspaceId !== null && item.workspaceId !== workspaceId) return 'wrong_workspace'
  return null
}
