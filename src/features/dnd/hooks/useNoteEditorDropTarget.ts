import { useEffect, useRef } from 'react'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Id } from 'convex/_generated/dataModel'
import {
  NOTE_EDITOR_DROP_TYPE,
  rejectionReasonMessage,
  resolveDropCommand,
} from '~/features/dnd/utils/dnd-registry'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getMinDisambiguationPath } from 'convex/links/linkResolution'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { resolveNormalizedDraggedSidebarItems } from '~/features/dnd/utils/sidebar-drag-items'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { handleError } from '~/shared/utils/logger'

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
  const { campaignId } = useCampaign()
  const setBatchDecision = useDndStore((s) => s.setBatchDecision)
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

        const items = resolveNormalizedDraggedSidebarItems({
          sourceData: source.data,
          activeItemsMap: itemsMapRef.current,
        })
        if (items.length === 0) return

        const { clientX, clientY } = location.current.input
        const { editor } = useNoteEditorStore.getState()
        if (!editor) return
        const tiptap = editor._tiptapEditor
        const posResult = tiptap.view.posAtCoords({
          left: clientX,
          top: clientY,
        })
        if (!posResult) return

        const command = resolveDropCommand(
          items,
          { type: NOTE_EDITOR_DROP_TYPE, noteId },
          {
            moveItems: () => Promise.resolve(),
            restoreItems: () => Promise.resolve(),
            trashItems: () => Promise.resolve(),
            navigateToItem: () => Promise.resolve(),
            campaignId: campaignId ?? null,
            campaignName: undefined,
            isDm: true,
            setFolderOpen: () => undefined,
          },
        )

        if (command.status === 'blocked') {
          handleError(new Error(rejectionReasonMessage(command.reason)), 'Cannot drop items here')
          return
        }
        if (command.status === 'noop' || command.action !== 'link') return

        const links = command.items.map((item) => {
          const pathParts = getMinDisambiguationPath(item, allItemsRef.current, itemsMapRef.current)
          const itemName = item.name.trim() || 'Untitled'
          const finalPathParts = pathParts.length === 0 ? [itemName] : pathParts
          const path = finalPathParts.join('/')
          const linkText = finalPathParts.length > 1 ? `${path}|${itemName}` : path
          return `[[${linkText}]]`
        })

        const insertLinks = async () => {
          if (links.length === 0) return
          const { editor: currentEditor, provider: currentProvider } = useNoteEditorStore.getState()
          const currentTiptap = currentEditor?._tiptapEditor
          if (!currentTiptap) return
          currentTiptap.chain().focus().insertContent(links.join('\n')).run()
          await currentProvider?.flushUpdates()
        }

        if (command.status === 'partial' || command.status === 'failed') {
          setBatchDecision({ command, onConfirm: insertLinks })
          return
        }

        void insertLinks().catch((error) => handleError(error, 'Failed to add links'))
      },
    })
  }, [campaignId, noteId, setBatchDecision])
}
