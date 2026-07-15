import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceRouteSearch } from '~/editor-adapters/workspace-route-search'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'

function parseStoredLastResource(value: unknown): ResourceId | null {
  return typeof value === 'string' ? parseDomainId(DOMAIN_ID_KIND.resource, value) : null
}

export function useLastResource() {
  const { campaignId } = useCampaign()

  const [lastSelectedResource, setLastSelectedResource] = usePersistedState<ResourceId | null>(
    `last-editor-resource-v1-${campaignId}`,
    null,
    parseStoredLastResource,
  )

  const lastSelectedResourceSearch: WorkspaceRouteSearch | undefined = lastSelectedResource
    ? { resource: lastSelectedResource }
    : undefined

  return {
    lastSelectedResource,
    lastSelectedResourceSearch,
    setLastSelectedResource,
  }
}
