import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { createReactInlineContentSpec } from '@blocknote/react'
import { useCampaign } from '~/contexts/CampaignContext'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

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
    render: (props) => {
      const { campaignWithMembership } = useCampaign()
      const campaign = campaignWithMembership?.data?.campaign
      const hasCampaign = !!campaign?._id
      const hasTagId = !!props.inlineContent.props.tagId
      const tag = useQuery(
        convexQuery(
          api.tags.queries.getTag,
          hasCampaign && hasTagId
            ? {
                campaignId: campaign!._id,
                tagId: props.inlineContent.props.tagId as Id<'tags'>,
              }
            : 'skip',
        ),
      )

      const name = tag.data?.name ?? props.inlineContent.props.tagName
      const color =
        tag.data?.color ??
        tag.data?.category?.defaultColor ??
        props.inlineContent.props.tagColor

      return (
        <span
          className="opacity-65"
          style={color ? { backgroundColor: `${color}35` } : undefined}
        >
          @{name}
        </span>
      )
    },
  },
)
