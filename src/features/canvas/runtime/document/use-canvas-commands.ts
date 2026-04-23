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

interface UseCanvasCommandsOptions {
  canEdit: boolean
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  selection: Pick<CanvasSelectionController, 'getSnapshot' | 'replace' | 'clear'>
}

interface CanvasCommand<TArgs = void, TResult = boolean> {
  id: string
  canRun: (args?: TArgs) => boolean
  run: (args?: TArgs) => TResult
}

interface CanvasSelectionCommandArgs {
  selection?: CanvasSelectionSnapshot
}

interface CanvasReorderCommandArgs extends CanvasSelectionCommandArgs {
  direction: CanvasReorderDirection
}

export interface CanvasCommands {
  copy: CanvasCommand<CanvasSelectionCommandArgs, boolean>
  cut: CanvasCommand<CanvasSelectionCommandArgs, boolean>
  paste: CanvasCommand<void, CanvasSelectionSnapshot | null>
  duplicate: CanvasCommand<CanvasSelectionCommandArgs, CanvasSelectionSnapshot | null>
  delete: CanvasCommand<CanvasSelectionCommandArgs, boolean>
  reorder: CanvasCommand<CanvasReorderCommandArgs, boolean>
}

export function useCanvasCommands({
  canEdit,
  nodesMap,
  edgesMap,
  selection,
}: UseCanvasCommandsOptions): CanvasCommands {
  const clipboard = useCanvasClipboardStore((state) => state.clipboard)
  const setClipboard = useCanvasClipboardStore((state) => state.setClipboard)
  const incrementPasteCount = useCanvasClipboardStore((state) => state.incrementPasteCount)

  const getSelectionSnapshot = (
    args?: CanvasSelectionCommandArgs | CanvasReorderCommandArgs,
  ): CanvasSelectionSnapshot => args?.selection ?? selection.getSnapshot()

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
    copy: {
      id: 'copy',
      canRun: (args) => getClipboardEntry(getSelectionSnapshot(args)) !== null,
      run: (args) => {
        const nextClipboard = getClipboardEntry(getSelectionSnapshot(args))
        if (!nextClipboard) {
          return false
        }

        setClipboard(nextClipboard)
        return true
      },
    },
    cut: {
      id: 'cut',
      canRun: (args) => canEdit && getClipboardEntry(getSelectionSnapshot(args)) !== null,
      run: (args) => {
        if (!canEdit) {
          return false
        }

        const snapshot = getSelectionSnapshot(args)
        const copied = getClipboardEntry(snapshot)
        if (!copied) {
          return false
        }

        if (!deleteSnapshotFromMaps(snapshot)) {
          return false
        }

        setClipboard(copied)
        selection.clear()
        return true
      },
    },
    paste: {
      id: 'paste',
      canRun: () => canEdit && clipboard !== null && clipboard.nodes.length > 0,
      run: () => {
        if (!canEdit || !clipboard || clipboard.nodes.length === 0) {
          return null
        }

        return applyPaste(materializeCanvasPaste(nodesMap, edgesMap, clipboard))
      },
    },
    duplicate: {
      id: 'duplicate',
      canRun: (args) => canEdit && getClipboardEntry(getSelectionSnapshot(args)) !== null,
      run: (args) => {
        if (!canEdit) {
          return null
        }

        const nextClipboard = getClipboardEntry(getSelectionSnapshot(args))
        if (!nextClipboard) {
          return null
        }

        setClipboard(nextClipboard)
        return applyPaste(materializeCanvasPaste(nodesMap, edgesMap, nextClipboard))
      },
    },
    delete: {
      id: 'delete',
      canRun: (args) => {
        if (!canEdit) {
          return false
        }

        const snapshot = getSelectionSnapshot(args)
        return snapshot.nodeIds.length > 0 || snapshot.edgeIds.length > 0
      },
      run: (args) => {
        if (!canEdit) {
          return false
        }

        const snapshot = getSelectionSnapshot(args)
        if (!deleteSnapshotFromMaps(snapshot)) {
          return false
        }

        selection.clear()
        return true
      },
    },
    reorder: {
      id: 'reorder',
      canRun: (args) => {
        if (!canEdit || !args) {
          return false
        }

        return (
          createCanvasReorderUpdates(
            nodesMap,
            edgesMap,
            getSelectionSnapshot(args),
            args.direction,
          ) !== null
        )
      },
      run: (args) => {
        if (!canEdit || !args) {
          return false
        }

        const reorderUpdates = createCanvasReorderUpdates(
          nodesMap,
          edgesMap,
          getSelectionSnapshot(args),
          args.direction,
        )
        if (!reorderUpdates) {
          return false
        }

        transactCanvasMaps(nodesMap, edgesMap, () => {
          applyCanvasReorderCommand({ nodesMap, edgesMap, reorderUpdates })
        })

        return true
      },
    },
  }
}
