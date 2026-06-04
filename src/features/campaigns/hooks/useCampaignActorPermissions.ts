import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { PermissionLevel } from 'shared/permissions/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useCampaignActor } from './useCampaignActor'
import {
  actorCanMutateSidebarItem,
  effectiveHasAtLeastPermission,
  getActorActionPermissionLevel,
  getActorPermissionLevel,
} from '~/features/sharing/utils/permission-utils'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'

export function useCampaignActorPermissions() {
  const actor = useCampaignActor()
  const { allItemsById } = useFileSystemReadModel()
  const context = { actor, allItemsMap: allItemsById }

  return {
    actor,
    allItemsMap: allItemsById,
    canView: (item: AnySidebarItem) =>
      effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, context),
    canEdit: (item: AnySidebarItem) =>
      effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.EDIT, context),
    canManage: (item: AnySidebarItem) =>
      actorCanMutateSidebarItem(item, PERMISSION_LEVEL.FULL_ACCESS, context),
    canMutate: (item: AnySidebarItem, requiredLevel: PermissionLevel) =>
      actorCanMutateSidebarItem(item, requiredLevel, context),
    getPermissionLevel: (item: AnySidebarItem) => getActorPermissionLevel(item, context),
    getActionPermissionLevel: (item: AnySidebarItem) =>
      getActorActionPermissionLevel(item, context),
    projectActionItem: <TItem extends AnySidebarItem>(item: TItem): TItem => ({
      ...item,
      myPermissionLevel: getActorActionPermissionLevel(item, context),
    }),
  }
}
