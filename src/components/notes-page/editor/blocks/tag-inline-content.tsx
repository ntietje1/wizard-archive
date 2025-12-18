import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { createReactInlineContentSpec } from '@blocknote/react'
import { useCampaign } from '~/contexts/CampaignContext'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

type TagInlineContentProps = {
  inlineContent: {
    props: {
      tagId: string
      tagName: string
      tagColor: string
    }
  }
}

function TagInlineContentRender({ inlineContent }: TagInlineContentProps) {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const hasCampaign = !!campaign?._id
  const hasTagId = !!inlineContent.props.tagId
  const tag = useQuery(
    convexQuery(
      api.tags.queries.getTag,
      hasCampaign && hasTagId
        ? {
            campaignId: campaign!._id,
            tagId: (inlineContent.props.tagId || '') as Id<'tags'>,
          }
        : 'skip',
    ),
  )

  const name = tag.data?.name ?? inlineContent.props.tagName
  const color =
    tag.data?.color ??
    tag.data?.category?.defaultColor ??
    inlineContent.props.tagColor

  return (
    <span
      className="opacity-65"
      style={color ? { backgroundColor: `${color}35` } : undefined}
    >
      @{name}
    </span>
  )
}

export const TagInlineContent = createReactInlineContentSpec(
  {
    type: 'tag' as const,
    propSchema: {
      tagId: { default: '' },
      tagName: { default: '' },
      tagColor: { default: '' },
    },
    content: 'none',
  },
  {
    render: TagInlineContentRender,
  },
)
