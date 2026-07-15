import type { ReactNode } from 'react'
import type { EditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { LiveWorkspaceRouteEffects } from './live-workspace-route-effects'
import { useLiveResourceCore } from './resources/use-live-resource-core'
import { useLiveResourceNavigation } from './resources/use-live-resource-navigation'

export function LiveWorkspaceRuntimeProvider({
  children,
}: {
  children: (runtime: EditorRuntime) => ReactNode
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
  children: (runtime: EditorRuntime) => ReactNode
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
  if (!resourceCore) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  return (
    <>
      <LiveWorkspaceRouteEffects resourceLoader={resourceCore.resources.loader} />
      {children(resourceCore)}
    </>
  )
}
