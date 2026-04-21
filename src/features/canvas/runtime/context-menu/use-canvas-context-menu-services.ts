import { parseEmbedNodeData } from '../../nodes/embed/embed-node-data'
import {
  applyCanvasPasteCommand,
  applyCanvasReorderCommand,
  createAndSelectEmbeddedCanvasNode,
  deleteCanvasSelectionCommand,
} from '../document/canvas-document-commands'
import { sanitizeNodeForPersistence } from '../document/canvas-node-persistence-sanitizer'
import { transactCanvasMaps } from '../document/canvas-yjs-transactions'
import { useCanvasClipboardStore } from './use-canvas-clipboard-store'
import { createCanvasClipboardEntry, materializeCanvasPaste } from './canvas-context-menu-clipboard'
import { createCanvasReorderUpdates } from './canvas-context-menu-reorder'
import type { CanvasContextMenuPoint, CanvasContextMenuServices } from './canvas-context-menu-types'
import type {
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'

interface UseCanvasContextMenuServicesOptions {
  canEdit: boolean
  campaignId: Id<'campaigns'>
  canvasParentId: Id<'sidebarItems'> | null
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  createNode: (node: Node) => void
  screenToFlowPosition: (position: CanvasContextMenuPoint) => { x: number; y: number }
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

export function useCanvasContextMenuServices({
  canEdit,
  campaignId,
  canvasParentId,
  nodesMap,
  edgesMap,
  createNode,
  screenToFlowPosition,
  selection,
}: UseCanvasContextMenuServicesOptions): CanvasContextMenuServices {
  const clipboard = useCanvasClipboardStore((state) => state.clipboard)
  const setClipboard = useCanvasClipboardStore((state) => state.setClipboard)
  const incrementPasteCount = useCanvasClipboardStore((state) => state.incrementPasteCount)
  const { createItem } = useCreateSidebarItem()
  const { getDefaultName } = useSidebarValidation()
  const { navigateToItem } = useEditorNavigation()
  const { itemsMap } = useActiveSidebarItems()

  const canPaste = () => canEdit && clipboard !== null && clipboard.nodes.length > 0
  const getClipboardEntry = (snapshot: CanvasSelectionSnapshot) =>
    createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)
  const applyPaste = (paste: ReturnType<typeof materializeCanvasPaste>) => {
    transactCanvasMaps(nodesMap, edgesMap, () => {
      applyCanvasPasteCommand({
        nodesMap,
        edgesMap,
        paste,
        sanitizeNode: sanitizeNodeForPersistence,
        onApplied: incrementPasteCount,
      })
    })

    selection.replace(paste.selection)
    return paste.selection
  }
  const deleteSnapshotFromMaps = (snapshot: CanvasSelectionSnapshot) => {
    let deleted = false

    transactCanvasMaps(nodesMap, edgesMap, () => {
      deleted = deleteCanvasSelectionCommand({ nodesMap, edgesMap, selection: snapshot })
    })

    return deleted
  }
  const resolveSelectedEmbedItem = (selectionSnapshot: CanvasSelectionSnapshot) => {
    if (selectionSnapshot.edgeIds.length > 0 || selectionSnapshot.nodeIds.length !== 1) {
      return null
    }

    const selectedNode = nodesMap.get(selectionSnapshot.nodeIds[0])
    if (selectedNode?.type !== 'embed') {
      return null
    }

    const sidebarItemId = parseEmbedNodeData(selectedNode.data).sidebarItemId
    if (!sidebarItemId) {
      return null
    }

    return itemsMap.get(sidebarItemId) ?? null
  }

  return {
    canPaste,
    canCopySnapshot: (snapshot) => getClipboardEntry(snapshot) !== null,
    canOpenEmbedSelection: (selectionSnapshot) =>
      resolveSelectedEmbedItem(selectionSnapshot) !== null,
    copySnapshot: (snapshot) => {
      const nextClipboard = getClipboardEntry(snapshot)
      if (!nextClipboard) {
        return false
      }

      setClipboard(nextClipboard)
      return true
    },
    cutSnapshot: (snapshot) => {
      if (!canEdit) {
        return false
      }

      const copied = getClipboardEntry(snapshot)
      if (!copied) {
        return false
      }

      setClipboard(copied)
      transactCanvasMaps(nodesMap, edgesMap, () => {
        deleteCanvasSelectionCommand({ nodesMap, edgesMap, selection: snapshot })
      })
      selection.clear()
      return true
    },
    pasteClipboard: () => {
      if (!canPaste() || !clipboard) {
        return null
      }

      return applyPaste(materializeCanvasPaste(nodesMap, edgesMap, clipboard))
    },
    duplicateSnapshot: (snapshot) => {
      if (!canEdit) {
        return null
      }

      const nextClipboard = getClipboardEntry(snapshot)
      if (!nextClipboard) {
        return null
      }

      setClipboard(nextClipboard)
      return applyPaste(materializeCanvasPaste(nodesMap, edgesMap, nextClipboard))
    },
    openEmbedSelection: async (selectionSnapshot) => {
      const item = resolveSelectedEmbedItem(selectionSnapshot)
      if (!item) {
        return false
      }

      await navigateToItem(item.slug)
      return true
    },
    deleteSnapshot: (snapshot) => {
      if (!canEdit) {
        return false
      }

      if (!deleteSnapshotFromMaps(snapshot)) {
        return false
      }

      selection.clear()
      return true
    },
    reorderSnapshot: (snapshot, direction) => {
      if (!canEdit) {
        return false
      }

      const reorderUpdates = createCanvasReorderUpdates(nodesMap, edgesMap, snapshot, direction)
      if (!reorderUpdates) {
        return false
      }

      transactCanvasMaps(nodesMap, edgesMap, () => {
        applyCanvasReorderCommand({ nodesMap, edgesMap, reorderUpdates })
      })

      return true
    },
    createAndEmbedSidebarItem: async (type, pointerPosition) => {
      if (!canEdit) {
        return null
      }

      const result = await createItem({
        type,
        campaignId,
        parentTarget: { kind: 'direct', parentId: canvasParentId },
        name: getDefaultName(type, canvasParentId),
      })

      return createAndSelectEmbeddedCanvasNode({
        sidebarItemId: result.id,
        pointerPosition,
        screenToFlowPosition,
        createNode,
        replaceSelection: selection.replace,
      })
    },
  } satisfies CanvasContextMenuServices
}
