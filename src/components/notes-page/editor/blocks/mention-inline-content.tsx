import { api } from 'convex/_generated/api'
import { createReactInlineContentSpec } from '@blocknote/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import type { SidebarItemId, SidebarItemType } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'
import { useEditorMode } from '~/hooks/useEditorMode'
import { validateHexColorOrDefault } from '~/lib/sidebar-item-utils'

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
  const { editorMode } = useEditorMode()
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

  const DEFAULT_COLOR = '#14b8a6'

  // Convert color to hex with alpha channel for background
  const getBackgroundColor = (
    colorValue: string | undefined | null,
  ): string | undefined => {
    if (!colorValue) return undefined

    const baseColor = validateHexColorOrDefault(colorValue, DEFAULT_COLOR)

    if (baseColor.length === 9) {
      // already has alpha
      return `${baseColor.slice(0, 7)}35`
    } else if (baseColor.length === 7) {
      // no alpha, add it
      return `${baseColor}35`
    } else {
      console.log('invalid hex color', baseColor)
      return `${DEFAULT_COLOR}35`
    }
  }

  return (
    <span
      className="opacity-65"
      style={color ? { backgroundColor: getBackgroundColor(color) } : undefined}
    >
      {editorMode === 'editor' ? `[[${displayName}]]` : displayName}
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
