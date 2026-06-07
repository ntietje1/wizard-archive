import { useEffect, useRef } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { NOTE_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { registerSurfaceDropExecutor } from '~/features/dnd/utils/surface-drop-command'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getMinDisambiguationPath } from 'shared/links/resolution'
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
    return registerSurfaceDropExecutor({
      action: 'link',
      target: { type: NOTE_EDITOR_DROP_TYPE, noteId },
      execute: async (linkCommand, input) => {
        const { clientX, clientY } = input
        const { editor } = useNoteEditorStore.getState()
        if (!editor) return

        const links = linkCommand.items.map((item) => {
          const pathParts = getMinDisambiguationPath(item, allItemsRef.current, itemsMapRef.current)
          const itemName = item.name.trim() || 'Untitled'
          const finalPathParts = pathParts.length === 0 ? [itemName] : pathParts
          const path = finalPathParts.join('/')
          const linkText = finalPathParts.length > 1 ? `${path}|${itemName}` : path
          return `[[${linkText}]]`
        })
        if (links.length === 0) return

        const { editor: currentEditor, provider: currentProvider } = useNoteEditorStore.getState()
        const currentTiptap = currentEditor?._tiptapEditor
        if (!currentTiptap) return
        const posResult = currentTiptap.view.posAtCoords({
          left: clientX,
          top: clientY,
        })
        if (!posResult) return

        currentTiptap.chain().focus().insertContentAt(posResult.pos, links.join('\n')).run()
        await currentProvider?.flushUpdates()
      },
    })
  }, [noteId])
}
