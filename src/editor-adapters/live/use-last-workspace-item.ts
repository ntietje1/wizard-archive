import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceRouteSearch } from '~/editor-adapters/workspace-route-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'

function parseStoredLastSelectedItem(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function useLastWorkspaceItem() {
  const { campaignId: workspaceRecordId } = useCampaign()

  const [storedLastSelectedItem, setStoredLastSelectedItem] = usePersistedState<string | null>(
    workspaceRecordId ? `last-editor-resource-v1-${workspaceRecordId}` : null,
    null,
    parseStoredLastSelectedItem,
  )
  const lastSelectedItem: ResourceId | null = storedLastSelectedItem
    ? parseDomainId(DOMAIN_ID_KIND.resource, storedLastSelectedItem)
    : null

  const setLastSelectedItem = (value: ResourceId | null) => {
    setStoredLastSelectedItem(value)
  }

  const lastSelectedWorkspaceItemSearch: WorkspaceRouteSearch | undefined = lastSelectedItem
    ? { item: lastSelectedItem }
    : undefined

  return {
    lastSelectedItem,
    lastSelectedWorkspaceItemSearch,
    setLastSelectedItem,
  }
}
