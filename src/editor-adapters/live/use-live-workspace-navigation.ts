import { useMatch, useNavigate } from '@tanstack/react-router'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceRouteSearch } from '~/editor-adapters/workspace-route-search'
import { EDITOR_ROUTE, EDITOR_ROUTE_ID } from '~/editor-adapters/live/editor-route'
import { useLastResource } from '~/editor-adapters/live/use-last-resource'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useLiveWorkspaceSelectedResourceId(): ResourceId | null {
  const editorMatch = useMatch({
    from: EDITOR_ROUTE_ID,
    shouldThrow: false,
  })
  return editorMatch?.search.resource ?? null
}

export const useLiveWorkspaceNavigation = () => {
  const navigate = useNavigate()
  const { campaignId } = useCampaign()
  const { lastSelectedResourceSearch, setLastSelectedResource } = useLastResource()

  const routeParams = { campaignId }

  const navigateToWorkspaceRoute = async (search: WorkspaceRouteSearch, replace?: boolean) => {
    await navigate({
      to: EDITOR_ROUTE,
      params: routeParams,
      search,
      replace,
    })
  }

  const navigateToResource = async (
    resourceId: ResourceId,
    options: { heading?: string; replace?: boolean } = {},
  ) => {
    setLastSelectedResource(resourceId)
    await navigateToWorkspaceRoute(
      options.heading
        ? { resource: resourceId, heading: options.heading }
        : { resource: resourceId },
      options.replace,
    )
  }

  const clearWorkspaceContent = async () => {
    await navigateToWorkspaceRoute({})
  }

  const navigateToTrash = async () => {
    await navigateToWorkspaceRoute({ trash: true })
  }

  const openLastResource = async () => {
    await navigateToWorkspaceRoute(lastSelectedResourceSearch ?? {})
  }

  const openCampaignsDashboard = async () => {
    await navigate({ to: '/campaigns' })
  }

  return {
    navigateToResource,
    clearWorkspaceContent,
    openLastResource,
    openCampaignsDashboard,
    navigateToTrash,
  }
}
