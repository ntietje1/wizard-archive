import type { ReactNode } from 'react'
import type { WizardEditorRuntime } from '@wizard-archive/editor/adapter'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
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

export function LiveWorkspaceRuntimeProvider({
  children,
}: {
  children: (runtime: WizardEditorRuntime) => ReactNode
}) {
  return <LiveWorkspaceRuntimeContent>{children}</LiveWorkspaceRuntimeContent>
}

function LiveWorkspaceRuntimeContent({
  children,
}: {
  children: (runtime: WizardEditorRuntime) => ReactNode
}) {
  const { campaignId: workspaceRecordId, campaignSlug, dmUsername } = useCampaign()

  if (!workspaceRecordId) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <LoadedLiveWorkspaceRuntimeContent
      workspaceId={workspaceRecordId}
      campaignSlug={campaignSlug}
      dmUsername={dmUsername}
    >
      {children}
    </LoadedLiveWorkspaceRuntimeContent>
  )
}

function LoadedLiveWorkspaceRuntimeContent({
  workspaceId,
  campaignSlug,
  children,
  dmUsername,
}: {
  workspaceId: string
  campaignSlug: ReturnType<typeof useCampaign>['campaignSlug']
  children: (runtime: WizardEditorRuntime) => ReactNode
  dmUsername: ReturnType<typeof useCampaign>['dmUsername']
}) {
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
      <LiveWorkspaceRouteEffects />
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
