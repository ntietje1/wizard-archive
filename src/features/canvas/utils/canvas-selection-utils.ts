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
  selectedIds: Array<string>,
  incomingIds: Array<string>,
): Array<string> {
  return Array.from(new Set([...selectedIds, ...incomingIds]))
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
  selectedIds: Array<string>
  targetId: string | null
  toggle: boolean
}): Array<string> {
  if (!targetId) {
    return toggle ? selectedIds : []
  }

  if (!toggle) {
    return [targetId]
  }

  if (selectedIds.includes(targetId)) {
    return selectedIds.filter((id) => id !== targetId)
  }

  return [...selectedIds, targetId]
}

export function isExclusivelySelectedNode(
  selectedNodeIds: Array<string>,
  targetId: string | null,
): boolean {
  return targetId !== null && selectedNodeIds.length === 1 && selectedNodeIds[0] === targetId
}
