type SelectionModifierEvent = Pick<React.MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>

export function isSelectionToggleModifier(event: SelectionModifierEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey
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
