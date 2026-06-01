import { useEffect, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Id } from 'convex/_generated/dataModel'
import { NOTE_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import {
  executeSurfaceDropCommand,
  resolveSidebarSurfaceDropCommand,
} from '~/features/dnd/utils/surface-drop-command'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { getMinDisambiguationPath } from 'shared/links/resolution'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

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
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
  const { campaignId } = useCampaign()
  const setBatchDecision = useDndStore((s) => s.setBatchDecision)
  const allItemsRef = useRef(allItems)
  allItemsRef.current = allItems
  const itemsMapRef = useRef(itemsMap)
  itemsMapRef.current = itemsMap
  const trashedItemsMapRef = useRef(trashedItemsMap)
  trashedItemsMapRef.current = trashedItemsMap

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        const topTarget = location.current.dropTargets[0]
        if (!topTarget) return
        if (topTarget.data.type !== NOTE_EDITOR_DROP_TYPE) return
        if (topTarget.data.noteId !== noteId) return

        const { clientX, clientY } = location.current.input
        const { editor } = useNoteEditorStore.getState()
        if (!editor) return

        const command = resolveSidebarSurfaceDropCommand({
          sourceData: source.data,
          activeItemsMap: itemsMapRef.current,
          trashedItemsMap: trashedItemsMapRef.current,
          target: { type: NOTE_EDITOR_DROP_TYPE, noteId },
          planningContext: {
            campaignId: campaignId ?? null,
          },
        })

        void executeSurfaceDropCommand({
          command,
          action: 'link',
          setBatchDecision,
          failureMessage: 'Failed to add links',
          execute: async (linkCommand) => {
            const links = linkCommand.items.map((item) => {
              const pathParts = getMinDisambiguationPath(
                item,
                allItemsRef.current,
                itemsMapRef.current,
              )
              const itemName = item.name.trim() || 'Untitled'
              const finalPathParts = pathParts.length === 0 ? [itemName] : pathParts
              const path = finalPathParts.join('/')
              const linkText = finalPathParts.length > 1 ? `${path}|${itemName}` : path
              return `[[${linkText}]]`
            })
            if (links.length === 0) return

            const { editor: currentEditor, provider: currentProvider } =
              useNoteEditorStore.getState()
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
      },
    })
  }, [campaignId, noteId, setBatchDecision])
}
