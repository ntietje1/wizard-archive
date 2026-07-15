import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceRouteSearch } from '~/editor-adapters/workspace-route-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'

function parseStoredLastResource(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function useLastResource() {
  const { campaignId: workspaceRecordId } = useCampaign()

  const [storedLastResource, setStoredLastResource] = usePersistedState<string | null>(
    workspaceRecordId ? `last-editor-resource-v1-${workspaceRecordId}` : null,
    null,
    parseStoredLastResource,
  )
  const lastSelectedResource: ResourceId | null = storedLastResource
    ? parseDomainId(DOMAIN_ID_KIND.resource, storedLastResource)
    : null

  const setLastSelectedResource = (value: ResourceId | null) => {
    setStoredLastResource(value)
  }

  const lastSelectedResourceSearch: WorkspaceRouteSearch | undefined = lastSelectedResource
    ? { resource: lastSelectedResource }
    : undefined

  return {
    lastSelectedResource,
    lastSelectedResourceSearch,
    setLastSelectedResource,
  }
}
