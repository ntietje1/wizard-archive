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
import { useLiveResourceNavigation } from './resources/use-live-resource-navigation'

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
  const { campaign, campaignId } = useCampaign()
  const membership = campaign.data?.myMembership

  if (!membership) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const projection = membership.role === CAMPAIGN_MEMBER_ROLE.DM ? 'dm' : 'player'
  return (
    <LoadedLiveWorkspaceRuntimeContent
      key={`${campaignId}:${membership.id}:${projection}`}
      workspaceId={campaignId}
      actorId={membership.id}
      projection={projection}
    >
      {children}
    </LoadedLiveWorkspaceRuntimeContent>
  )
}

function LoadedLiveWorkspaceRuntimeContent({
  workspaceId,
  actorId,
  children,
  projection,
}: {
  workspaceId: CampaignId
  actorId: CampaignMemberId
  children: (runtime: WorkspaceRuntime) => ReactNode
  projection: 'dm' | 'player'
}) {
  const resourceNavigation = useLiveResourceNavigation()
  const resourceCore = useLiveResourceCore(
    {
      campaignId: workspaceId,
      actorId,
      projection,
      schema: RESOURCE_INDEX_SCHEMA,
    },
    resourceNavigation,
  )
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
      openSeparateLiveWorkspaceItem({ campaignId: workspaceId, heading, resourceId }),
  })

  return (
    <>
      <LiveWorkspaceRouteEffects resourceLoader={resourceCore.resources.loader} />
      {children(runtime)}
      {liveFileSystemRuntime.filesystem.dialog}
    </>
  )
}

const openSeparateLiveWorkspaceItem = ({
  campaignId,
  heading,
  resourceId,
}: Parameters<LiveWorkspaceSeparateItemNavigation>[0] & {
  campaignId: CampaignId
}) => {
  const searchParams = new URLSearchParams({ item: resourceId })
  if (heading) searchParams.set('heading', heading)
  const path = `${createEditorRoutePath({ campaignId })}?${searchParams.toString()}`
  window.open(path, '_blank', 'noopener,noreferrer')
}
