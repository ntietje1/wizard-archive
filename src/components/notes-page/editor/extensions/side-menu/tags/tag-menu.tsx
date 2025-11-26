import type { Tag } from 'convex/tags/types'
import { filterSuggestionItems } from '@blocknote/core'
import {
  type DefaultReactSuggestionItem,
  SuggestionMenuController,
} from '@blocknote/react'
import { useTags, getTagColor } from '~/hooks/useTags'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import { toast } from 'sonner'
import { TAG_INLINE_CONTENT_TYPE } from 'convex/tags/editorSpecs'

const getTagMenuItems = (
  onAddTag: (tag: Tag) => void,
  tags?: Tag[],
): DefaultReactSuggestionItem[] => {
  if (!tags) return []

  return tags.map((tag: Tag) => ({
    title: tag.displayName,
    onItemClick: () => onAddTag(tag),
  }))
}

export default function TagMenu({
  editor,
}: {
  editor?: CustomBlockNoteEditor
}) {
  const { nonSystemManagedTags } = useTags()

  const onAddTag = (tag: Tag) => {
    if (!editor) return

    const tagContent = {
      tagId: tag._id,
      tagName: tag.displayName,
      tagColor: getTagColor(tag),
    }

    try {
      editor.insertInlineContent([
        {
          type: TAG_INLINE_CONTENT_TYPE,
          props: tagContent,
        },
        ' ', // add a space after the mention
      ])
    } catch (error) {
      console.error('Failed to insert tag:', error)
      toast.error('Failed to insert tag')
    }
  }

  return (
    <SuggestionMenuController
      triggerCharacter={'@'}
      getItems={async (query) =>
        filterSuggestionItems(
          getTagMenuItems(onAddTag, nonSystemManagedTags),
          query,
        )
      }
    />
  )
}
