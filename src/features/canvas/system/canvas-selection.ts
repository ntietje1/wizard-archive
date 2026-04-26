export type CanvasSelectionGestureKind = 'marquee' | 'lasso'
export type CanvasSelectionCommitMode = 'replace' | 'add'

export interface CanvasSelectionSnapshot {
  nodeIds: ReadonlySet<string>
  edgeIds: ReadonlySet<string>
}

type CanvasPendingSelectionPreview =
  | { kind: 'inactive' }
  | ({ kind: 'active' } & CanvasSelectionSnapshot)

export interface CanvasSelectionState extends CanvasSelectionSnapshot {
  pendingPreview: CanvasPendingSelectionPreview
  gestureKind: CanvasSelectionGestureKind | null
  gestureMode: CanvasSelectionCommitMode | null
  gestureStartSelection: CanvasSelectionSnapshot | null
}

interface CanvasVisualSelectionState {
  selected: boolean
  pendingPreviewActive: boolean
  pendingSelected: boolean
  visuallySelected: boolean
}

const EMPTY_SET: ReadonlySet<string> = new Set()

function createEmptyCanvasSelectionSnapshot(): CanvasSelectionSnapshot {
  return {
    nodeIds: EMPTY_SET,
    edgeIds: EMPTY_SET,
  }
}

export function createInitialCanvasSelectionState(): CanvasSelectionState {
  return {
    ...createEmptyCanvasSelectionSnapshot(),
    pendingPreview: createInactiveCanvasPendingSelectionPreview(),
    gestureKind: null,
    gestureMode: null,
    gestureStartSelection: null,
  }
}

export function createInactiveCanvasPendingSelectionPreview(): CanvasPendingSelectionPreview {
  return { kind: 'inactive' }
}

export function isCanvasPendingPreviewActive(
  preview: CanvasPendingSelectionPreview,
): preview is Extract<CanvasPendingSelectionPreview, { kind: 'active' }> {
  return preview.kind === 'active'
}

export function getCanvasPendingSelectionPreviewSummary(preview: CanvasPendingSelectionPreview): {
  active: boolean
  nodeCount: number
  edgeCount: number
} {
  if (preview.kind === 'inactive') {
    return {
      active: false,
      nodeCount: 0,
      edgeCount: 0,
    }
  }

  return {
    active: true,
    nodeCount: preview.nodeIds.size,
    edgeCount: preview.edgeIds.size,
  }
}

export function getCanvasVisualSelectionState({
  selected,
  pendingPreview,
  id,
  kind,
}: {
  selected: boolean
  pendingPreview: CanvasPendingSelectionPreview
  id: string
  kind: 'node' | 'edge'
}): CanvasVisualSelectionState {
  const pendingPreviewActive = pendingPreview.kind === 'active'
  const pendingSelected =
    pendingPreview.kind === 'active' &&
    (kind === 'node' ? pendingPreview.nodeIds.has(id) : pendingPreview.edgeIds.has(id))

  return {
    selected,
    pendingPreviewActive,
    pendingSelected,
    visuallySelected: pendingPreviewActive ? pendingSelected : selected,
  }
}

export function areCanvasVisualSelectionStatesEqual(
  left: CanvasVisualSelectionState,
  right: CanvasVisualSelectionState,
) {
  return (
    left.selected === right.selected &&
    left.pendingPreviewActive === right.pendingPreviewActive &&
    left.pendingSelected === right.pendingSelected &&
    left.visuallySelected === right.visuallySelected
  )
}

export function areStringSetsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left === right) {
    return true
  }
  if (left.size !== right.size) {
    return false
  }

  for (const id of left) {
    if (!right.has(id)) {
      return false
    }
  }

  return true
}

export function areCanvasSelectionsEqual(
  left: CanvasSelectionSnapshot,
  right: CanvasSelectionSnapshot,
) {
  return (
    areStringSetsEqual(left.nodeIds, right.nodeIds) &&
    areStringSetsEqual(left.edgeIds, right.edgeIds)
  )
}

export function applyCanvasSelectionCommitMode({
  currentSelection,
  nextSelection,
  mode,
}: {
  currentSelection: CanvasSelectionSnapshot
  nextSelection: CanvasSelectionSnapshot
  mode: CanvasSelectionCommitMode
}): CanvasSelectionSnapshot {
  if (mode === 'replace') {
    return nextSelection
  }

  return {
    nodeIds: mergeSelectedIds(currentSelection.nodeIds, nextSelection.nodeIds),
    edgeIds: mergeSelectedIds(currentSelection.edgeIds, nextSelection.edgeIds),
  }
}

export function getNextSelectedIds({
  selectedIds,
  targetId,
  additive,
}: {
  selectedIds: ReadonlySet<string>
  targetId: string | null
  additive: boolean
}): ReadonlySet<string> {
  if (!targetId) {
    return additive ? selectedIds : EMPTY_SET
  }

  if (!additive) {
    return new Set([targetId])
  }

  const nextIds = new Set(selectedIds)
  if (nextIds.has(targetId)) {
    nextIds.delete(targetId)
    return nextIds
  }

  nextIds.add(targetId)
  return nextIds
}

export function isExclusivelySelectedNode(
  selectedNodeIds: ReadonlySet<string>,
  targetId: string | null,
): boolean {
  return targetId !== null && selectedNodeIds.size === 1 && selectedNodeIds.has(targetId)
}

export function mergeSelectedIds(
  selectedIds: ReadonlySet<string>,
  incomingIds: ReadonlySet<string>,
): ReadonlySet<string> {
  if (incomingIds.size === 0) {
    return selectedIds
  }

  const mergedIds = new Set(selectedIds)
  for (const id of incomingIds) {
    mergedIds.add(id)
  }
  return mergedIds
}
