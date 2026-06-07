import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useSidebarItemsQueries } from '~/features/sidebar/hooks/useSidebarItems'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import type { SidebarItemsValue } from '../contexts/sidebar-items-context'
import type { SidebarWorkspaceSource } from './sidebar-workspace-source'

export function useLiveSidebarWorkspaceSource(): SidebarWorkspaceSource {
  const items = useSidebarItemsQueries()
  const { campaignActor } = useEditorMode()
  const filteredActiveItems =
    campaignActor?.kind === 'dm'
      ? items.active
      : filterSidebarItemsForActor(items.active, campaignActor)

  return {
    items,
    filteredActiveItems,
  }
}

function filterSidebarItemsForActor(
  activeItems: SidebarItemsValue,
  campaignActor: ReturnType<typeof useEditorMode>['campaignActor'],
): SidebarItemsValue {
  const permOpts = { actor: campaignActor, allItemsMap: activeItems.itemsMap }
  const filteredData = activeItems.data.filter((item) =>
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )

  return {
    data: filteredData,
    status: activeItems.status,
    error: activeItems.error,
    refetch: activeItems.refetch,
    ...buildSidebarItemMaps(filteredData),
  }
}
