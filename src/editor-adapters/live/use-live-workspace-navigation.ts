import { useMatch, useNavigate } from '@tanstack/react-router'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceRouteSearch } from '~/editor-adapters/workspace-route-search'
import { EDITOR_ROUTE, EDITOR_ROUTE_ID } from '~/editor-adapters/live/editor-route'
import { useLastWorkspaceItem } from '~/editor-adapters/live/use-last-workspace-item'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useLiveWorkspaceSelectedResourceId(): ResourceId | null {
  const editorMatch = useMatch({
    from: EDITOR_ROUTE_ID,
    shouldThrow: false,
  })
  return editorMatch?.search.item ?? null
}

export const useLiveWorkspaceNavigation = () => {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const { lastSelectedWorkspaceItemSearch, setLastSelectedItem } = useLastWorkspaceItem()

  const routeParams = { dmUsername, campaignSlug }

  const navigateToWorkspaceRoute = async (search: WorkspaceRouteSearch, replace?: boolean) => {
    await navigate({
      to: EDITOR_ROUTE,
      params: routeParams,
      search,
      replace,
    })
  }

  const navigateToItem = async (
    resourceId: ResourceId,
    options: { heading?: string; replace?: boolean } = {},
  ) => {
    setLastSelectedItem(resourceId)
    await navigateToWorkspaceRoute(
      options.heading ? { item: resourceId, heading: options.heading } : { item: resourceId },
      options.replace,
    )
  }

  const clearWorkspaceContent = async () => {
    await navigateToWorkspaceRoute({})
  }

  const navigateToTrash = async () => {
    await navigateToWorkspaceRoute({ trash: true })
  }

  const openLastWorkspaceItem = async () => {
    await navigateToWorkspaceRoute(lastSelectedWorkspaceItemSearch ?? {})
  }

  const openCampaignsDashboard = async () => {
    await navigate({ to: '/campaigns' })
  }

  return {
    navigateToItem,
    clearWorkspaceContent,
    openLastWorkspaceItem,
    openCampaignsDashboard,
    navigateToTrash,
  }
}
