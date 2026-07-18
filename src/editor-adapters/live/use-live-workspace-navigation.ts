import { useMatch, useNavigate } from '@tanstack/react-router'
import type { CanonicalTarget } from '@wizard-archive/editor/resources/authored-destination-contract'
import {
  workspaceRouteSearchForTarget,
  workspaceRouteTarget,
} from '~/editor-adapters/workspace-route-search'
import type { WorkspaceRouteSearch } from '~/editor-adapters/workspace-route-search'
import { EDITOR_ROUTE, EDITOR_ROUTE_ID } from '~/editor-adapters/live/editor-route'
import { useLastResource } from '~/editor-adapters/live/use-last-resource'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useLiveWorkspaceSelectedTarget(): CanonicalTarget | null {
  const editorMatch = useMatch({
    from: EDITOR_ROUTE_ID,
    shouldThrow: false,
  })
  return editorMatch ? workspaceRouteTarget(editorMatch.search) : null
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

  const navigateToTarget = async (target: CanonicalTarget, replace?: boolean) => {
    setLastSelectedResource(target.resourceId)
    await navigateToWorkspaceRoute(workspaceRouteSearchForTarget(target), replace)
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
    navigateToTarget,
    clearWorkspaceContent,
    openLastResource,
    openCampaignsDashboard,
    navigateToTrash,
  }
}
