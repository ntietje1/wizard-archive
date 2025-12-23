import { filterSuggestionItems } from '@blocknote/core'
import {
  
  SuggestionMenuController
} from '@blocknote/react'
import { toast } from 'sonner'
import { TAG_INLINE_CONTENT_TYPE } from 'convex/tags/editorSpecs'
import type {DefaultReactSuggestionItem} from '@blocknote/react';
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'
import type { Tag } from 'convex/tags/types'
import { getTagColor, useTags } from '~/hooks/useTags'

const getTagMenuItems = (
  onAddTag: (tag: Tag) => void,
  tags?: Array<Tag>,
): Array<DefaultReactSuggestionItem> => {
  if (!tags) return []

  return tags.map((tag: Tag) => ({
    title: tag.name || '',
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
      tagName: tag.name || '',
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
