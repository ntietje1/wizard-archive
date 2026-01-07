import { filterSuggestionItems } from '@blocknote/core'
import { toast } from 'sonner'
import { MENTION_INLINE_CONTENT_TYPE } from 'convex/mentions/editorSpecs'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import CustomMentionMenu from './custom-mention-menu'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import { buildBreadcrumbs } from '~/lib/mention-menu-utils'
import { getItemTypeLabel } from '~/lib/sidebar-item-utils'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

const getMentionMenuItems = (
  onAddMention: (item: AnySidebarItem) => void,
  items?: Array<AnySidebarItem>,
  itemsMap?: Map<SidebarItemId, AnySidebarItem>,
): Array<DefaultReactSuggestionItem> => {
  if (!items || !itemsMap) return []

  return items.map((item: AnySidebarItem) => {
    const breadcrumbs = buildBreadcrumbs(item, itemsMap)
    const typeLabel = getItemTypeLabel(item.type)
    const subtext = breadcrumbs

    return {
      key: item._id,
      title: item.name || defaultItemName(item),
      subtext,
      badge: typeLabel,
      onItemClick: () => onAddMention(item),
    }
  })
}

export default function MentionMenu({
  editor,
}: {
  editor?: CustomBlockNoteEditor
}) {
  const { data: sidebarItems, itemsMap } = useAllSidebarItems()

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
    <CustomMentionMenu
      getItems={(query) =>
        Promise.resolve(
          filterSuggestionItems(
            getMentionMenuItems(onAddMention, sidebarItems, itemsMap),
            query,
          ),
        )
      }
    />
  )
}
