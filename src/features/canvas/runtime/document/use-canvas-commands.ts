import {
  applyCanvasPasteCommand,
  applyCanvasReorderCommand,
  deleteCanvasSelectionCommand,
  setCanvasNodePositionsCommand,
} from './canvas-document-commands'
import { createCanvasArrangePlan } from './canvas-arrange'
import { createCanvasReorderPlan } from './canvas-reorder-plan'
import { sanitizeNodeForPersistence } from './canvas-node-persistence-sanitizer'
import { transactCanvasMaps } from './canvas-yjs-transactions'
import { useCanvasClipboardStore } from '../context-menu/use-canvas-clipboard-store'
import {
  createCanvasClipboardEntry,
  materializeCanvasPaste,
} from '../context-menu/canvas-context-menu-clipboard'
import { useMemo } from 'react'
import type { CanvasArrangeAction } from './canvas-arrange'
import type { CanvasReorderDirection } from './canvas-reorder'
import type {
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/types/canvas-domain-types'
import type * as Y from 'yjs'

interface UseCanvasCommandsOptions {
  canEdit: boolean
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  selection: Pick<CanvasSelectionController, 'getSnapshot' | 'setSelection' | 'clearSelection'>
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
  _reorderPlan?: ReturnType<typeof createCanvasReorderPlan>
}

interface CanvasArrangeCommandArgs extends CanvasSelectionCommandArgs {
  action: CanvasArrangeAction
  _arrangePlan?: ReturnType<typeof createCanvasArrangePlan>
}

export interface CanvasCommands {
  copy: CanvasCommand<CanvasSelectionCommandArgs, boolean>
  cut: CanvasCommand<CanvasSelectionCommandArgs, boolean>
  paste: CanvasCommand<void, CanvasSelectionSnapshot | null>
  duplicate: CanvasCommand<CanvasSelectionCommandArgs, CanvasSelectionSnapshot | null>
  delete: CanvasCommand<CanvasSelectionCommandArgs, boolean>
  reorder: CanvasCommand<CanvasReorderCommandArgs, boolean>
  arrange: CanvasCommand<CanvasArrangeCommandArgs, boolean>
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

  return useMemo(() => {
    const getSelectionSnapshot = (
      args?: CanvasSelectionCommandArgs | CanvasReorderCommandArgs,
    ): CanvasSelectionSnapshot => args?.selection ?? selection.getSnapshot()

    const getClipboardEntry = (snapshot: CanvasSelectionSnapshot) =>
      createCanvasClipboardEntry(nodesMap, edgesMap, snapshot)

    const hasCopyableSelection = (snapshot: CanvasSelectionSnapshot) => {
      for (const nodeId of snapshot.nodeIds) {
        if (nodesMap.has(nodeId)) {
          return true
        }
      }

      for (const edgeId of snapshot.edgeIds) {
        if (edgesMap.has(edgeId)) {
          return true
        }
      }

      return false
    }

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

      selection.setSelection(paste.selection)
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
        canRun: (args) => hasCopyableSelection(getSelectionSnapshot(args)),
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
        canRun: (args) => canEdit && hasCopyableSelection(getSelectionSnapshot(args)),
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
          selection.clearSelection()
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
        canRun: (args) => canEdit && hasCopyableSelection(getSelectionSnapshot(args)),
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
          return snapshot.nodeIds.size > 0 || snapshot.edgeIds.size > 0
        },
        run: (args) => {
          if (!canEdit) {
            return false
          }

          const snapshot = getSelectionSnapshot(args)
          if (!deleteSnapshotFromMaps(snapshot)) {
            return false
          }

          selection.clearSelection()
          return true
        },
      },
      reorder: {
        id: 'reorder',
        canRun: (args) => {
          if (!canEdit || !args) {
            return false
          }

          args._reorderPlan = createCanvasReorderPlan(
            nodesMap,
            edgesMap,
            getSelectionSnapshot(args),
            args.direction,
          )
          return args._reorderPlan !== null
        },
        run: (args) => {
          if (!canEdit || !args) {
            return false
          }

          const reorderPlan =
            args._reorderPlan ??
            createCanvasReorderPlan(nodesMap, edgesMap, getSelectionSnapshot(args), args.direction)
          args._reorderPlan = undefined
          if (!reorderPlan) {
            return false
          }

          transactCanvasMaps(nodesMap, edgesMap, () => {
            applyCanvasReorderCommand({ nodesMap, edgesMap, reorderUpdates: reorderPlan })
          })

          return true
        },
      },
      arrange: {
        id: 'arrange',
        canRun: (args) => {
          if (!canEdit || !args) {
            return false
          }

          args._arrangePlan = createCanvasArrangePlan(
            nodesMap,
            getSelectionSnapshot(args),
            args.action,
          )
          return args._arrangePlan !== null
        },
        run: (args) => {
          if (!canEdit || !args) {
            return false
          }

          const arrangePlan =
            args._arrangePlan ??
            createCanvasArrangePlan(nodesMap, getSelectionSnapshot(args), args.action)
          args._arrangePlan = undefined
          if (!arrangePlan) {
            return false
          }

          transactCanvasMaps(nodesMap, edgesMap, () => {
            setCanvasNodePositionsCommand({
              nodesMap,
              positions: arrangePlan,
              sanitizeNode: sanitizeNodeForPersistence,
            })
          })

          return true
        },
      },
    }
  }, [canEdit, clipboard, edgesMap, incrementPasteCount, nodesMap, selection, setClipboard])
}
