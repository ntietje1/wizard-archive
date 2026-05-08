import { useEffect, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { NOTE_EDITOR_DROP_TYPE, getDragItemIds } from '~/features/dnd/utils/dnd-registry'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getMinDisambiguationPath } from 'convex/links/linkResolution'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'

export function useNoteEditorDropTarget({
  ref,
  noteId,
}: {
  ref: React.RefObject<HTMLElement | null>
  noteId: Id<'sidebarItems'>
}) {
  const dropData = { type: NOTE_EDITOR_DROP_TYPE, noteId }
  useDndDropTarget({
    ref,
    data: dropData,
    highlightId: `note:${noteId}`,
  })

  const { data: allItems, itemsMap } = useActiveSidebarItems()
  const allItemsRef = useRef(allItems)
  allItemsRef.current = allItems
  const itemsMapRef = useRef(itemsMap)
  itemsMapRef.current = itemsMap

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return
        if (topTarget.data.type !== NOTE_EDITOR_DROP_TYPE) return
        if (topTarget.data.noteId !== noteId) return

        const items = getDragItemIds(source.data)
          .map((sid) => itemsMapRef.current.get(sid))
          .filter(
            (item): item is NonNullable<typeof item> =>
              item !== undefined && item.location !== SIDEBAR_ITEM_LOCATION.trash,
          )
        if (items.length === 0) return

        const { clientX, clientY } = location.current.input
        const editor = useNoteEditorStore.getState().editor
        if (!editor) return
        const tiptap = editor._tiptapEditor
        const posResult = tiptap.view.posAtCoords({
          left: clientX,
          top: clientY,
        })
        if (!posResult) return

        const links = items.map((item) => {
          const pathParts = getMinDisambiguationPath(item, allItemsRef.current, itemsMapRef.current)
          const path = pathParts.join('/')
          const linkText = pathParts.length > 1 ? `${path}|${item.name}` : path
          return `[[${linkText}]]`
        })

        tiptap.chain().focus().insertContentAt(posResult.pos, links.join(' ')).run()
      },
    })
  }, [noteId])
}
