type SelectionModifierEvent = Pick<React.MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>

export function isSelectionToggleModifier(event: SelectionModifierEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey
}

export function getNextSelectedNodeIds({
  selectedNodeIds,
  targetId,
  toggle,
}: {
  selectedNodeIds: Array<string>
  targetId: string | null
  toggle: boolean
}): Array<string> {
  if (!targetId) {
    return toggle ? selectedNodeIds : []
  }

  if (!toggle) {
    return [targetId]
  }

  if (selectedNodeIds.includes(targetId)) {
    return selectedNodeIds.filter((id) => id !== targetId)
  }

  return [...selectedNodeIds, targetId]
}

export function isExclusivelySelectedNode(
  selectedNodeIds: Array<string>,
  targetId: string | null,
): boolean {
  return targetId !== null && selectedNodeIds.length === 1 && selectedNodeIds[0] === targetId
}
