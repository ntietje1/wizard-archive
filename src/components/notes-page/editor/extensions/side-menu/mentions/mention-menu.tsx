import { filterSuggestionItems } from '@blocknote/core'
import { SuggestionMenuController } from '@blocknote/react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { MENTION_INLINE_CONTENT_TYPE } from 'convex/mentions/editorSpecs'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'

const getMentionMenuItems = (
  onAddMention: (item: AnySidebarItem) => void,
  items?: Array<AnySidebarItem>,
): Array<DefaultReactSuggestionItem> => {
  if (!items) return []

  return items.map((item: AnySidebarItem) => ({
    title: item.name || defaultItemName(item),
    onItemClick: () => onAddMention(item),
  }))
}

export default function MentionMenu({
  editor,
}: {
  editor?: CustomBlockNoteEditor
}) {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign

  // Get all sidebar items that can be mentioned
  const sidebarItemsQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.getAllSidebarItems,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )

  const sidebarItems = sidebarItemsQuery.data ?? []

  const onAddMention = (item: AnySidebarItem) => {
    if (!editor) return

    const mentionContent = {
      sidebarItemId: item._id,
      sidebarItemType: item.type,
      displayName: item.name || defaultItemName(item),
      color: item.color || '',
    }

    try {
      editor.insertInlineContent([
        {
          type: MENTION_INLINE_CONTENT_TYPE,
          props: mentionContent,
        },
        ' ', // add a space after the mention
      ])
    } catch (error) {
      console.error('Failed to insert mention:', error)
      toast.error('Failed to insert mention')
    }
  }

  return (
    <SuggestionMenuController
      triggerCharacter={'@'}
      getItems={(query) =>
        Promise.resolve(
          filterSuggestionItems(
            getMentionMenuItems(onAddMention, sidebarItems),
            query,
          ),
        )
      }
    />
  )
}
