import { api } from 'convex/_generated/api'
import { createReactInlineContentSpec } from '@blocknote/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import type { SidebarItemId, SidebarItemType } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'

type MentionInlineContentProps = {
  inlineContent: {
    props: {
      sidebarItemId: SidebarItemId | string
      sidebarItemType: SidebarItemType | string
      displayName: string
      color: string
    }
  }
}

function MentionInlineContentRender({
  inlineContent,
}: MentionInlineContentProps) {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const hasCampaign = !!campaign?._id
  const hasItemId = !!inlineContent.props.sidebarItemId

  const item = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItem,
      hasCampaign && hasItemId
        ? {
            campaignId: campaign._id,
            id: inlineContent.props.sidebarItemId as SidebarItemId,
          }
        : 'skip',
    ),
  )

  const displayName = item.data?.name ?? inlineContent.props.displayName
  const color = item.data?.color ?? inlineContent.props.color

  return (
    <span
      className="opacity-65"
      style={color ? { backgroundColor: `${color}35` } : undefined}
    >
      @{displayName}
    </span>
  )
}

export const MentionInlineContent = createReactInlineContentSpec(
  {
    type: 'mention' as const,
    propSchema: {
      sidebarItemId: { default: '' },
      sidebarItemType: { default: '' },
      displayName: { default: '' },
      color: { default: '' },
    },
    content: 'none',
  },
  {
    render: MentionInlineContentRender,
  },
)
