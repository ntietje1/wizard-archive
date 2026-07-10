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
import type { CanvasArrangeAction } from './canvas-arrange'
import type { CanvasReorderDirection } from './canvas-reorder'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type * as Y from 'yjs'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'

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
}

interface CanvasArrangeCommandArgs extends CanvasSelectionCommandArgs {
  action: CanvasArrangeAction
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

export function useCanvasDocumentCommands({
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

  const hasCopyableSelection = (snapshot: CanvasSelectionSnapshot) =>
    getClipboardEntry(snapshot) !== null

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
    let deletedCount = 0

    transactCanvasMaps(nodesMap, edgesMap, () => {
      const deletion = deleteCanvasSelectionCommand({ nodesMap, edgesMap, selection: snapshot })
      deletedCount = deletion.nodeCount + deletion.edgeCount
    })

    return deletedCount > 0
  }

  const canRunPlanCommand = <TArgs, TPlan>(
    args: TArgs | undefined,
    createPlan: (args: TArgs) => TPlan | null,
  ) => canEdit && !!args && createPlan(args) !== null

  const runPlanCommand = <TArgs, TPlan>(
    args: TArgs | undefined,
    createPlan: (args: TArgs) => TPlan | null,
    applyPlan: (plan: TPlan) => void,
  ) => {
    if (!canEdit || !args) {
      return false
    }

    const plan = createPlan(args)
    if (!plan) {
      return false
    }

    transactCanvasMaps(nodesMap, edgesMap, () => {
      applyPlan(plan)
    })

    return true
  }

  const createReorderPlan = (args: CanvasReorderCommandArgs) =>
    createCanvasReorderPlan(nodesMap, edgesMap, getSelectionSnapshot(args), args.direction)

  const createArrangePlan = (args: CanvasArrangeCommandArgs) =>
    createCanvasArrangePlan(nodesMap, getSelectionSnapshot(args), args.action)

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
      canRun: (args) => canRunPlanCommand(args, createReorderPlan),
      run: (args) =>
        runPlanCommand(args, createReorderPlan, (reorderPlan) => {
          applyCanvasReorderCommand({ nodesMap, edgesMap, reorderUpdates: reorderPlan })
        }),
    },
    arrange: {
      id: 'arrange',
      canRun: (args) => canRunPlanCommand(args, createArrangePlan),
      run: (args) =>
        runPlanCommand(args, createArrangePlan, (arrangePlan) => {
          setCanvasNodePositionsCommand({
            nodesMap,
            positions: arrangePlan,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        }),
    },
  }
}
