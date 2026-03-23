import { useEffect, useMemo, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import {
  NOTE_EDITOR_DROP_TYPE,
  getDragItemId,
} from '~/features/dnd/utils/dnd-registry'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useAllSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getMinDisambiguationPath } from '~/features/editor/hooks/useWikiLinkExtension'

/**
 * Registers the note editor as a pragmatic-dnd drop target.
 * When a non-trashed sidebar item is dropped, inserts a [[wiki-link]]
 * at the drop position.
 */
export function useNoteEditorDropTarget({
  ref,
  editor,
  noteId,
}: {
  ref: React.RefObject<HTMLElement | null>
  editor: CustomBlockNoteEditor
  noteId: Id<'notes'>
}) {
  const dropData = useMemo(
    () => ({ type: NOTE_EDITOR_DROP_TYPE, noteId }),
    [noteId],
  )
  useDndDropTarget({
    ref,
    data: dropData,
    highlightId: `note:${noteId}`,
  })

  const { data: allItems, itemsMap } = useAllSidebarItems()
  const editorRef = useRef(editor)
  editorRef.current = editor
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

        const sid = getDragItemId(source.data)
        if (!sid) return
        const item = itemsMapRef.current.get(sid)
        if (!item || item.deletionTime) return

        const { clientX, clientY } = location.current.input
        const tiptap = editorRef.current._tiptapEditor
        const posResult = tiptap.view.posAtCoords({
          left: clientX,
          top: clientY,
        })
        if (!posResult) return

        const pathParts = getMinDisambiguationPath(
          item,
          allItemsRef.current,
          itemsMapRef.current,
        )
        const path = pathParts.join('/')
        const linkText = pathParts.length > 1 ? `${path}|${item.name}` : path

        tiptap
          .chain()
          .focus()
          .insertContentAt(posResult.pos, `[[${linkText}]]`)
          .run()
      },
    })
  }, [noteId])
}
