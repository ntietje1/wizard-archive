import type { ReactNode } from 'react'
import type { WorkspaceRuntime } from '@wizard-archive/editor/runtime'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useFileSystemReadModel } from './filesystem/read-model'
import { useLiveFileSystemRuntime } from './filesystem/host'
import { LiveWorkspaceRouteEffects } from './live-workspace-route-effects'
import {
  useLiveWorkspaceNavigation,
  useLiveWorkspaceSelectedResourceId,
} from './use-live-workspace-navigation'
import { useLiveWorkspaceRuntime } from './use-live-workspace-runtime'
import type { LiveWorkspaceSeparateItemNavigation } from './use-live-workspace-runtime'
import { openBrowserExternalUrl } from '~/editor-adapters/browser/open-browser-external-url'
import { createEditorRoutePath } from './editor-route'
import { useLiveResourceCore } from './resources/use-live-resource-core'

export function LiveWorkspaceRuntimeProvider({
  children,
}: {
  children: (runtime: WorkspaceRuntime) => ReactNode
}) {
  return <LiveWorkspaceRuntimeContent>{children}</LiveWorkspaceRuntimeContent>
}

function LiveWorkspaceRuntimeContent({
  children,
}: {
  children: (runtime: WorkspaceRuntime) => ReactNode
}) {
  const { campaign, campaignId, campaignSlug, dmUsername } = useCampaign()
  const membership = campaign.data?.myMembership

  if (!campaignId || !membership) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <LoadedLiveWorkspaceRuntimeContent
      workspaceId={campaignId}
      actorId={membership.id}
      campaignSlug={campaignSlug}
      dmUsername={dmUsername}
      projection={membership.role === CAMPAIGN_MEMBER_ROLE.DM ? 'dm' : 'player'}
    >
      {children}
    </LoadedLiveWorkspaceRuntimeContent>
  )
}

function LoadedLiveWorkspaceRuntimeContent({
  workspaceId,
  actorId,
  campaignSlug,
  children,
  dmUsername,
  projection,
}: {
  workspaceId: CampaignId
  actorId: CampaignMemberId
  campaignSlug: ReturnType<typeof useCampaign>['campaignSlug']
  children: (runtime: WorkspaceRuntime) => ReactNode
  dmUsername: ReturnType<typeof useCampaign>['dmUsername']
  projection: 'dm' | 'player'
}) {
  const resourceCore = useLiveResourceCore({
    campaignId: workspaceId,
    actorId,
    projection,
    schema: RESOURCE_INDEX_SCHEMA,
  })
  const filesystemReadModel = useFileSystemReadModel()
  const liveWorkspaceNavigation = useLiveWorkspaceNavigation()
  const currentResourceId = useLiveWorkspaceSelectedResourceId()
  const liveFileSystemRuntime = useLiveFileSystemRuntime(
    workspaceId,
    {
      getCurrentResourceId: () => currentResourceId,
      clearWorkspaceContent: liveWorkspaceNavigation.clearWorkspaceContent,
      openResource: (resource, options) =>
        liveWorkspaceNavigation.navigateToItem(resource.id, options),
    },
    filesystemReadModel,
  )
  const runtime = useLiveWorkspaceRuntime({
    workspaceId,
    filesystemReadModel,
    filesystemHost: liveFileSystemRuntime.filesystem,
    sidebarItemsShareOperations: liveFileSystemRuntime.sharing.sidebarItems,
    openExternalUrl: openBrowserExternalUrl,
    openSeparateItem: ({ heading, resourceId }) =>
      openSeparateLiveWorkspaceItem({ campaignSlug, dmUsername, heading, resourceId }),
  })

  return (
    <>
      <LiveWorkspaceRouteEffects resourceLoader={resourceCore.loader} />
      {children(runtime)}
      {liveFileSystemRuntime.filesystem.dialog}
    </>
  )
}

const openSeparateLiveWorkspaceItem = ({
  campaignSlug,
  dmUsername,
  heading,
  resourceId,
}: Parameters<LiveWorkspaceSeparateItemNavigation>[0] & {
  campaignSlug: ReturnType<typeof useCampaign>['campaignSlug']
  dmUsername: ReturnType<typeof useCampaign>['dmUsername']
}) => {
  const searchParams = new URLSearchParams({ item: resourceId })
  if (heading) searchParams.set('heading', heading)
  const path = `${createEditorRoutePath({ dmUsername, campaignSlug })}?${searchParams.toString()}`
  window.open(path, '_blank', 'noopener,noreferrer')
}
