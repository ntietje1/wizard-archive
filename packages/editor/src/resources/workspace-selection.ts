import type { ResourceId } from './domain-id'

export type WorkspaceSelection = Readonly<{
  selectedIds: ReadonlyArray<ResourceId>
  anchorId: ResourceId | null
  focusedId: ResourceId | null
}>

export type WorkspaceSelectionAction =
  | Readonly<{
      type: 'select'
      resourceId: ResourceId
      visibleIds: ReadonlyArray<ResourceId>
      intent: 'single' | 'toggle' | 'range'
    }>
  | Readonly<{
      type: 'moveFocus'
      direction: 'previous' | 'next'
      visibleIds: ReadonlyArray<ResourceId>
      extend: boolean
    }>
  | Readonly<{ type: 'focus'; resourceId: ResourceId }>
  | Readonly<{ type: 'normalizeContext'; resourceId: ResourceId }>
  | Readonly<{ type: 'clear' }>

export const EMPTY_WORKSPACE_SELECTION: WorkspaceSelection = {
  selectedIds: [],
  anchorId: null,
  focusedId: null,
}

export function workspaceSelectionIntent(
  modifiers: Readonly<{ shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }>,
  platform: 'mac' | 'other' = isMacPlatform() ? 'mac' : 'other',
) {
  if (modifiers.shiftKey) return 'range' as const
  if (modifiers.metaKey || (modifiers.ctrlKey && platform === 'other')) return 'toggle' as const
  return 'single' as const
}

export function updateWorkspaceSelection(
  selection: WorkspaceSelection,
  action: WorkspaceSelectionAction,
): WorkspaceSelection {
  switch (action.type) {
    case 'select':
      return select(selection, action)
    case 'moveFocus':
      return moveFocus(selection, action)
    case 'focus':
      return { ...selection, focusedId: action.resourceId }
    case 'normalizeContext':
      return selection.selectedIds.includes(action.resourceId)
        ? selection
        : singleSelection(action.resourceId)
    case 'clear':
      return EMPTY_WORKSPACE_SELECTION
  }
}

function select(
  selection: WorkspaceSelection,
  action: Extract<WorkspaceSelectionAction, { type: 'select' }>,
) {
  if (action.intent === 'single') return singleSelection(action.resourceId)
  if (action.intent === 'range') {
    const anchorId = visibleAnchor(selection, action.resourceId, action.visibleIds)
    return {
      selectedIds: visibleRange(anchorId, action.resourceId, action.visibleIds),
      anchorId,
      focusedId: action.resourceId,
    }
  }

  const selectedIds = selection.selectedIds.includes(action.resourceId)
    ? selection.selectedIds.filter((resourceId) => resourceId !== action.resourceId)
    : [...selection.selectedIds, action.resourceId]
  const anchorId =
    selection.anchorId && selectedIds.includes(selection.anchorId)
      ? selection.anchorId
      : (selectedIds[0] ?? null)
  return { selectedIds, anchorId, focusedId: action.resourceId }
}

function moveFocus(
  selection: WorkspaceSelection,
  action: Extract<WorkspaceSelectionAction, { type: 'moveFocus' }>,
) {
  if (action.visibleIds.length === 0) return selection
  const currentIndex = selection.focusedId ? action.visibleIds.indexOf(selection.focusedId) : -1
  const nextIndex =
    currentIndex === -1
      ? action.direction === 'previous'
        ? action.visibleIds.length - 1
        : 0
      : action.direction === 'previous'
        ? Math.max(0, currentIndex - 1)
        : Math.min(action.visibleIds.length - 1, currentIndex + 1)
  const focusedId = action.visibleIds[nextIndex]
  if (!focusedId) return selection
  if (!action.extend) return singleSelection(focusedId)

  const anchorId = visibleAnchor(selection, focusedId, action.visibleIds)
  return {
    selectedIds: visibleRange(anchorId, focusedId, action.visibleIds),
    anchorId,
    focusedId,
  }
}

function visibleAnchor(
  selection: WorkspaceSelection,
  targetId: ResourceId,
  visibleIds: ReadonlyArray<ResourceId>,
) {
  if (selection.anchorId && visibleIds.includes(selection.anchorId)) return selection.anchorId
  if (selection.focusedId && visibleIds.includes(selection.focusedId)) return selection.focusedId
  return targetId
}

function visibleRange(
  anchorId: ResourceId,
  targetId: ResourceId,
  visibleIds: ReadonlyArray<ResourceId>,
) {
  const anchorIndex = visibleIds.indexOf(anchorId)
  const targetIndex = visibleIds.indexOf(targetId)
  if (anchorIndex === -1 || targetIndex === -1) return [targetId]
  return visibleIds.slice(
    Math.min(anchorIndex, targetIndex),
    Math.max(anchorIndex, targetIndex) + 1,
  )
}

function singleSelection(resourceId: ResourceId): WorkspaceSelection {
  return { selectedIds: [resourceId], anchorId: resourceId, focusedId: resourceId }
}

function isMacPlatform() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}
