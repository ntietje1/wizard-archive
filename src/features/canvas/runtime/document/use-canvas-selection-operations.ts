import {
  applyCanvasPasteCommand,
  applyCanvasReorderCommand,
  deleteCanvasSelectionCommand,
} from './canvas-document-commands'
import { sanitizeNodeForPersistence } from './canvas-node-persistence-sanitizer'
import { transactCanvasMaps } from './canvas-yjs-transactions'
import { useCanvasClipboardStore } from '../context-menu/use-canvas-clipboard-store'
import {
  createCanvasClipboardEntry,
  materializeCanvasPaste,
} from '../context-menu/canvas-context-menu-clipboard'
import { createCanvasReorderUpdates } from '../context-menu/canvas-context-menu-reorder'
import type { CanvasReorderDirection } from './canvas-reorder'
import type {
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasSelectionOperationsOptions {
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'replace' | 'clear'>
}

export interface CanvasSelectionOperations {
  canPaste: () => boolean
  canCopySnapshot: (selection: CanvasSelectionSnapshot) => boolean
  copySnapshot: (selection: CanvasSelectionSnapshot) => boolean
  cutSnapshot: (selection: CanvasSelectionSnapshot) => boolean
  pasteClipboard: () => CanvasSelectionSnapshot | null
  duplicateSnapshot: (selection: CanvasSelectionSnapshot) => CanvasSelectionSnapshot | null
  deleteSnapshot: (selection: CanvasSelectionSnapshot) => boolean
  reorderSnapshot: (
    selection: CanvasSelectionSnapshot,
    direction: CanvasReorderDirection,
  ) => boolean
}

export function useCanvasSelectionOperations({
  canEdit,
  nodesMap,
  edgesMap,
  selection,
}: UseCanvasSelectionOperationsOptions): CanvasSelectionOperations {
  const clipboard = useCanvasClipboardStore((state) => state.clipboard)
  const setClipboard = useCanvasClipboardStore((state) => state.setClipboard)
  const incrementPasteCount = useCanvasClipboardStore((state) => state.incrementPasteCount)

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

  return {
    canPaste,
    canCopySnapshot: (snapshot) => getClipboardEntry(snapshot) !== null,
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
  }
}
