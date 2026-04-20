import { transactCanvasMaps } from '../document/canvas-yjs-transactions'
import { useCanvasClipboardStore } from './use-canvas-clipboard-store'
import {
  createCanvasClipboardEntry,
  materializeCanvasPaste,
} from './canvas-context-menu-clipboard'
import { createCanvasReorderUpdates } from './canvas-context-menu-reorder'
import { getCanvasDeletionSelection } from './canvas-context-menu-selection'
import type {
  CanvasClipboardEntry,
  CanvasContextMenuServices,
} from './canvas-context-menu-types'
import type {
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasContextMenuServicesOptions {
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

export function useCanvasContextMenuServices({
  canEdit,
  nodesMap,
  edgesMap,
  selection,
}: UseCanvasContextMenuServicesOptions): CanvasContextMenuServices {
  const clipboard = useCanvasClipboardStore((state) => state.clipboard)
  const setClipboard = useCanvasClipboardStore((state) => state.setClipboard)
  const incrementPasteCount = useCanvasClipboardStore((state) => state.incrementPasteCount)

  const canPaste = () => canEdit && clipboard !== null && clipboard.nodes.length > 0

  return {
    canPaste,
    canCopySnapshot: (snapshot) => createCanvasClipboardEntry(nodesMap, edgesMap, snapshot) !== null,
    copySnapshot: (snapshot) => {
      const nextClipboard = createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)
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

      const copied = createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)
      if (!copied) {
        return false
      }

      const deletionSelection = getCanvasDeletionSelection(edgesMap, snapshot)
      transactCanvasMaps(nodesMap, edgesMap, () => {
        setClipboard(copied)
        for (const edgeId of deletionSelection.edgeIds) {
          edgesMap.delete(edgeId)
        }
        for (const nodeId of deletionSelection.nodeIds) {
          nodesMap.delete(nodeId)
        }
      })
      selection.clear()
      return true
    },
    pasteClipboard: () => {
      if (!canEdit || !clipboard || clipboard.nodes.length === 0) {
        return null
      }

      const paste = materializeCanvasPaste(nodesMap, edgesMap, clipboard)
      transactCanvasMaps(nodesMap, edgesMap, () => {
        for (const node of paste.nodes) {
          nodesMap.set(node.id, node)
        }
        for (const edge of paste.edges) {
          edgesMap.set(edge.id, edge)
        }
        incrementPasteCount()
      })

      selection.replace(paste.selection)
      return paste.selection
    },
    duplicateSnapshot: (snapshot) => {
      if (!canEdit) {
        return null
      }

      const nextClipboard = createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)
      if (!nextClipboard) {
        return null
      }

      setClipboard(nextClipboard)

      const paste = materializeCanvasPaste(nodesMap, edgesMap, nextClipboard)
      transactCanvasMaps(nodesMap, edgesMap, () => {
        for (const node of paste.nodes) {
          nodesMap.set(node.id, node)
        }
        for (const edge of paste.edges) {
          edgesMap.set(edge.id, edge)
        }
        incrementPasteCount()
      })

      selection.replace(paste.selection)
      return paste.selection
    },
    deleteSnapshot: (snapshot) => {
      if (!canEdit) {
        return false
      }

      const deletionSelection = getCanvasDeletionSelection(edgesMap, snapshot)
      if (deletionSelection.nodeIds.length === 0 && deletionSelection.edgeIds.length === 0) {
        return false
      }

      transactCanvasMaps(nodesMap, edgesMap, () => {
        for (const edgeId of deletionSelection.edgeIds) {
          edgesMap.delete(edgeId)
        }
        for (const nodeId of deletionSelection.nodeIds) {
          nodesMap.delete(nodeId)
        }
      })
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
        reorderUpdates.nodes?.forEach((node) => {
          nodesMap.set(node.id, node)
        })
        reorderUpdates.edges?.forEach((edge) => {
          edgesMap.set(edge.id, edge)
        })
      })

      return true
    },
  } satisfies CanvasContextMenuServices
}
