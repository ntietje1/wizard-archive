import type { CanvasSelectionCommitMode, CanvasSelectionSnapshot } from '../tools/canvas-tool-types'

type PrimarySelectionModifierEvent = {
  ctrlKey: boolean
  metaKey: boolean
}

type CanvasPlatform = 'mac' | 'windows' | 'linux'

function detectCanvasPlatform(): CanvasPlatform {
  if (typeof navigator === 'undefined') {
    return 'linux'
  }

  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()

  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac'
  }
  if (platform.includes('win')) {
    return 'windows'
  }

  return 'linux'
}

export function isPrimarySelectionModifier(
  event: PrimarySelectionModifierEvent,
  platform: CanvasPlatform = detectCanvasPlatform(),
): boolean {
  return platform === 'mac' ? event.metaKey : event.ctrlKey
}

export function mergeSelectedIds(
  selectedIds: ReadonlySet<string>,
  incomingIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const mergedIds = new Set(selectedIds)
  for (const id of incomingIds) {
    mergedIds.add(id)
  }
  return mergedIds
}

export function areStringSetsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) {
    return true
  }
  if (a.size !== b.size) {
    return false
  }

  for (const value of a) {
    if (!b.has(value)) {
      return false
    }
  }

  return true
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
  toggle,
}: {
  selectedIds: ReadonlySet<string>
  targetId: string | null
  toggle: boolean
}): ReadonlySet<string> {
  if (!targetId) {
    return toggle ? selectedIds : new Set()
  }

  if (!toggle) {
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
