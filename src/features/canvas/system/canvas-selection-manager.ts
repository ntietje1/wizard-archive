import {
  areCanvasSelectionsEqual,
  createInactiveCanvasPendingSelectionPreview,
  getNextSelectedIds,
  isCanvasPendingPreviewActive,
} from './canvas-selection'
import { EMPTY_SET } from './canvas-document-projector'
import type { CanvasEngineSnapshot } from './canvas-engine-types'
import type {
  CanvasSelectionCommitMode,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
  CanvasSelectionState,
} from './canvas-selection'

type SelectionUpdate = Omit<CanvasEngineSnapshot, 'version'> | null

interface CanvasSelectionManager {
  setSelection: (
    snapshot: CanvasEngineSnapshot,
    selection: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> },
  ) => SelectionUpdate
  clearSelection: (snapshot: CanvasEngineSnapshot) => SelectionUpdate
  toggleNodeSelection: (
    snapshot: CanvasEngineSnapshot,
    nodeId: string,
    additive: boolean,
  ) => SelectionUpdate
  toggleEdgeSelection: (
    snapshot: CanvasEngineSnapshot,
    edgeId: string,
    additive: boolean,
  ) => SelectionUpdate
  beginGesture: (
    snapshot: CanvasEngineSnapshot,
    kind: CanvasSelectionGestureKind,
    mode: CanvasSelectionCommitMode,
  ) => SelectionUpdate
  setGesturePreview: (
    snapshot: CanvasEngineSnapshot,
    selection: CanvasSelectionSnapshot | null,
  ) => SelectionUpdate
  commitGesture: (snapshot: CanvasEngineSnapshot) => SelectionUpdate
  cancelGesture: (snapshot: CanvasEngineSnapshot) => SelectionUpdate
}

export function createCanvasSelectionManager(): CanvasSelectionManager {
  const setSelection: CanvasSelectionManager['setSelection'] = (snapshot, { nodeIds, edgeIds }) => {
    const nextCommittedSelection = {
      nodeIds,
      edgeIds,
    }

    if (
      areCanvasSelectionsEqual(snapshot.selection, nextCommittedSelection) &&
      snapshot.selection.pendingPreview.kind === 'inactive' &&
      snapshot.selection.gestureKind === null
    ) {
      return null
    }

    const nextSelection: CanvasSelectionState = {
      ...snapshot.selection,
      nodeIds: new Set(nodeIds),
      edgeIds: new Set(edgeIds),
      pendingPreview: createInactiveCanvasPendingSelectionPreview(),
      gestureKind: null,
      gestureMode: null,
      gestureStartSelection: null,
    }
    const dirtyNodeIds = getChangedSelectionIds(snapshot.selection.nodeIds, nodeIds)
    const dirtyEdgeIds = getChangedSelectionIds(snapshot.selection.edgeIds, edgeIds)

    return {
      ...snapshot,
      selection: nextSelection,
      selectedNodeIds: nextSelection.nodeIds,
      selectedEdgeIds: nextSelection.edgeIds,
      nodeLookup: updateSelectionLookup(snapshot.nodeLookup, nodeIds, dirtyNodeIds),
      edgeLookup: updateSelectionLookup(snapshot.edgeLookup, edgeIds, dirtyEdgeIds),
      dirtyNodeIds,
      dirtyEdgeIds,
    }
  }

  const cancelGesture: CanvasSelectionManager['cancelGesture'] = (snapshot) => {
    if (
      snapshot.selection.pendingPreview.kind === 'inactive' &&
      snapshot.selection.gestureKind === null
    ) {
      return null
    }

    const previousPreview = snapshot.selection.pendingPreview
    const nextSelection: CanvasSelectionState = {
      ...snapshot.selection,
      pendingPreview: createInactiveCanvasPendingSelectionPreview(),
      gestureKind: null,
      gestureMode: null,
      gestureStartSelection: null,
    }

    return {
      ...snapshot,
      selection: nextSelection,
      selectedNodeIds: nextSelection.nodeIds,
      selectedEdgeIds: nextSelection.edgeIds,
      dirtyNodeIds: getChangedPreviewNodeIds(previousPreview, nextSelection.pendingPreview),
      dirtyEdgeIds: getChangedPreviewEdgeIds(previousPreview, nextSelection.pendingPreview),
    }
  }

  return {
    setSelection,
    clearSelection: (snapshot) =>
      setSelection(snapshot, { nodeIds: EMPTY_SET, edgeIds: EMPTY_SET }),
    toggleNodeSelection: (snapshot, nodeId, additive) =>
      setSelection(snapshot, {
        nodeIds: getNextSelectedIds({
          selectedIds: snapshot.selection.nodeIds,
          targetId: nodeId,
          additive,
        }),
        edgeIds: additive ? snapshot.selection.edgeIds : EMPTY_SET,
      }),
    toggleEdgeSelection: (snapshot, edgeId, additive) =>
      setSelection(snapshot, {
        nodeIds: additive ? snapshot.selection.nodeIds : EMPTY_SET,
        edgeIds: getNextSelectedIds({
          selectedIds: snapshot.selection.edgeIds,
          targetId: edgeId,
          additive,
        }),
      }),
    beginGesture: (snapshot, kind, mode) => {
      if (
        snapshot.selection.gestureKind === kind &&
        snapshot.selection.gestureMode === mode &&
        snapshot.selection.pendingPreview.kind === 'inactive'
      ) {
        return null
      }

      const nextSelection: CanvasSelectionState = {
        ...snapshot.selection,
        pendingPreview: createInactiveCanvasPendingSelectionPreview(),
        gestureKind: kind,
        gestureMode: mode,
        gestureStartSelection: {
          nodeIds: snapshot.selection.nodeIds,
          edgeIds: snapshot.selection.edgeIds,
        },
      }

      return {
        ...snapshot,
        selection: nextSelection,
        selectedNodeIds: nextSelection.nodeIds,
        selectedEdgeIds: nextSelection.edgeIds,
        dirtyNodeIds: EMPTY_SET,
        dirtyEdgeIds: EMPTY_SET,
      }
    },
    setGesturePreview: (snapshot, selection) => {
      const pendingPreview = selection
        ? {
            kind: 'active' as const,
            nodeIds: new Set(selection.nodeIds),
            edgeIds: new Set(selection.edgeIds),
          }
        : createInactiveCanvasPendingSelectionPreview()
      const previousPreview = snapshot.selection.pendingPreview
      if (
        previousPreview.kind === pendingPreview.kind &&
        (pendingPreview.kind === 'inactive' ||
          (previousPreview.kind === 'active' &&
            areCanvasSelectionsEqual(previousPreview, pendingPreview)))
      ) {
        return null
      }

      const nextSelection: CanvasSelectionState = {
        ...snapshot.selection,
        pendingPreview,
      }

      return {
        ...snapshot,
        selection: nextSelection,
        selectedNodeIds: nextSelection.nodeIds,
        selectedEdgeIds: nextSelection.edgeIds,
        dirtyNodeIds: getChangedPreviewNodeIds(previousPreview, pendingPreview),
        dirtyEdgeIds: getChangedPreviewEdgeIds(previousPreview, pendingPreview),
      }
    },
    commitGesture: (snapshot) => {
      const { pendingPreview, gestureMode } = snapshot.selection
      if (isCanvasPendingPreviewActive(pendingPreview)) {
        return setSelection(snapshot, {
          nodeIds: pendingPreview.nodeIds,
          edgeIds: pendingPreview.edgeIds,
        })
      }

      if (gestureMode !== null || snapshot.selection.gestureKind !== null) {
        return cancelGesture(snapshot)
      }

      return null
    },
    cancelGesture,
  }
}

function getChangedSelectionIds(previous: ReadonlySet<string>, next: ReadonlySet<string>) {
  const changed = new Set<string>()
  for (const id of previous) {
    if (!next.has(id)) {
      changed.add(id)
    }
  }
  for (const id of next) {
    if (!previous.has(id)) {
      changed.add(id)
    }
  }
  return changed
}

function updateSelectionLookup<TValue extends { selected: boolean }>(
  lookup: ReadonlyMap<string, TValue>,
  selectedIds: ReadonlySet<string>,
  changedIds: ReadonlySet<string>,
) {
  if (changedIds.size === 0) {
    return lookup
  }

  const nextLookup = new Map(lookup)
  for (const id of changedIds) {
    const existing = lookup.get(id)
    if (!existing) {
      continue
    }
    nextLookup.set(id, {
      ...existing,
      selected: selectedIds.has(id),
    })
  }
  return nextLookup
}

function getChangedPreviewNodeIds(
  previous: CanvasSelectionState['pendingPreview'],
  next: CanvasSelectionState['pendingPreview'],
) {
  return getChangedSelectionIds(
    previous.kind === 'active' ? previous.nodeIds : EMPTY_SET,
    next.kind === 'active' ? next.nodeIds : EMPTY_SET,
  )
}

function getChangedPreviewEdgeIds(
  previous: CanvasSelectionState['pendingPreview'],
  next: CanvasSelectionState['pendingPreview'],
) {
  return getChangedSelectionIds(
    previous.kind === 'active' ? previous.edgeIds : EMPTY_SET,
    next.kind === 'active' ? next.edgeIds : EMPTY_SET,
  )
}
