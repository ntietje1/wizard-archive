import type { ResourceId } from '../resources/domain-id'
interface FileSystemSelectionSnapshot {
  selectedItemIds: ReadonlyArray<ResourceId>
  anchorItemId: ResourceId | null
  focusedItemId: ResourceId | null
}

interface FileSystemSelectionRangeResolution {
  selectedItemIds: Array<ResourceId>
  anchorItemId: ResourceId
}

export interface FileSystemSelection extends FileSystemSelectionSnapshot {
  setSelectedItemIds: (ids: ReadonlyArray<ResourceId>, anchorId?: ResourceId | null) => void
  selectSingleItem: (id: ResourceId) => void
  toggleItemSelection: (id: ResourceId) => void
  selectItemRange: (targetId: ResourceId, visibleItemIds: ReadonlyArray<ResourceId>) => void
  setFocusedItem: (id: ResourceId | null) => void
  moveFocus: (
    direction: 'up' | 'down',
    visibleItemIds: ReadonlyArray<ResourceId>,
    extendSelection: boolean,
  ) => void
  clearItemSelection: () => void
  normalizeContextSelection: (id: ResourceId, visibleItemIds?: ReadonlyArray<ResourceId>) => void
  getSelectionSnapshot: () => FileSystemSelectionSnapshot
}

type SetFileSystemSelection = (
  selectedIds: ReadonlyArray<ResourceId>,
  focusedItemId?: ResourceId | null,
  anchorItemId?: ResourceId | null,
) => void

function createStaticFileSystemSelection({
  currentItemId,
  fallbackSelectedItemIds,
}: {
  currentItemId: ResourceId | null
  fallbackSelectedItemIds: Array<ResourceId>
}): FileSystemSelection {
  let snapshot: FileSystemSelectionSnapshot = {
    selectedItemIds: [...fallbackSelectedItemIds],
    anchorItemId: currentItemId,
    focusedItemId: currentItemId,
  }
  const setSelection = (
    selectedIds: ReadonlyArray<ResourceId>,
    focusedItemId: ResourceId | null = selectedIds[0] ?? null,
    anchorItemId: ResourceId | null = focusedItemId ?? selectedIds[0] ?? null,
  ) => {
    snapshot = {
      selectedItemIds: [...selectedIds],
      anchorItemId,
      focusedItemId,
    }
  }

  return createFileSystemSelection({
    getSnapshot: () => snapshot,
    setSelection,
  })
}

export function createCurrentItemFileSystemSelection(
  currentItem: { id: ResourceId } | null,
): FileSystemSelection {
  const selectedItemIds = currentItem ? [currentItem.id] : []
  return createStaticFileSystemSelection({
    currentItemId: selectedItemIds[0] ?? null,
    fallbackSelectedItemIds: selectedItemIds,
  })
}

export function resolveFileSystemSelectionRange({
  anchorId,
  fallbackAnchorId = null,
  targetId,
  visibleItemIds,
}: {
  anchorId: ResourceId | null
  fallbackAnchorId?: ResourceId | null
  targetId: ResourceId
  visibleItemIds: ReadonlyArray<ResourceId>
}): FileSystemSelectionRangeResolution {
  const anchorItemId = resolveVisibleSelectionAnchorId(
    anchorId,
    fallbackAnchorId,
    targetId,
    visibleItemIds,
  )
  return {
    selectedItemIds: selectVisibleFileSystemItemRange(anchorItemId, targetId, visibleItemIds),
    anchorItemId,
  }
}

function resolveVisibleSelectionAnchorId(
  anchorId: ResourceId | null,
  fallbackAnchorId: ResourceId | null,
  targetId: ResourceId,
  visibleItemIds: ReadonlyArray<ResourceId>,
): ResourceId {
  if (anchorId && visibleItemIds.includes(anchorId)) return anchorId
  if (fallbackAnchorId && visibleItemIds.includes(fallbackAnchorId)) return fallbackAnchorId
  return targetId
}

function selectVisibleFileSystemItemRange(
  anchorId: ResourceId,
  targetId: ResourceId,
  visibleItemIds: ReadonlyArray<ResourceId>,
): Array<ResourceId> {
  const anchorIndex = visibleItemIds.indexOf(anchorId)
  const targetIndex = visibleItemIds.indexOf(targetId)

  if (anchorIndex === -1 || targetIndex === -1) {
    return [targetId]
  }

  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  return visibleItemIds.slice(start, end + 1)
}

export function selectionBelongsToSurface(
  selectedIds: ReadonlyArray<ResourceId>,
  visibleItemIds: ReadonlyArray<ResourceId>,
): boolean {
  if (selectedIds.length === 0) return false
  const visible = new Set(visibleItemIds)
  return selectedIds.every((id) => visible.has(id))
}

export function getNextFileSystemFocusedItemId(
  currentId: ResourceId | null,
  direction: 'up' | 'down',
  visibleItemIds: ReadonlyArray<ResourceId>,
) {
  if (visibleItemIds.length === 0) return null
  const currentIndex = currentId ? visibleItemIds.indexOf(currentId) : -1
  if (currentIndex === -1) {
    // If focus is outside the visible list, start keyboard navigation from the edge opposite movement.
    return direction === 'up' ? visibleItemIds[visibleItemIds.length - 1] : visibleItemIds[0]
  }

  const nextIndex =
    direction === 'up'
      ? Math.max(0, currentIndex - 1)
      : Math.min(visibleItemIds.length - 1, currentIndex + 1)
  return visibleItemIds[nextIndex]
}

function createFileSystemSelection({
  getSnapshot,
  setSelection,
}: {
  getSnapshot: () => FileSystemSelectionSnapshot
  setSelection: SetFileSystemSelection
}): FileSystemSelection {
  const getPublicSnapshot = () => detachSelectionSnapshot(getSnapshot())

  return {
    get selectedItemIds() {
      return [...getSnapshot().selectedItemIds]
    },
    get anchorItemId() {
      return getSnapshot().anchorItemId
    },
    get focusedItemId() {
      return getSnapshot().focusedItemId
    },
    setSelectedItemIds: (ids, anchorId) => {
      const nextAnchor =
        anchorId === undefined
          ? (ids[0] ?? null)
          : anchorId === null
            ? null
            : ids.includes(anchorId)
              ? anchorId
              : (ids[0] ?? null)
      setSelection(ids, nextAnchor, nextAnchor)
    },
    selectSingleItem: (id) => setSelection([id], id, id),
    toggleItemSelection: (id) => toggleSelection(getSnapshot(), setSelection, id),
    selectItemRange: (targetId, visibleItemIds) =>
      selectRange(getSnapshot(), setSelection, targetId, visibleItemIds),
    setFocusedItem: (id) => {
      const snapshot = getSnapshot()
      setSelection(snapshot.selectedItemIds, id, snapshot.anchorItemId)
    },
    moveFocus: (direction, visibleItemIds, extendSelection) =>
      moveFocus(getSnapshot(), setSelection, direction, visibleItemIds, extendSelection),
    clearItemSelection: () => setSelection([], null, null),
    normalizeContextSelection: (id) => {
      if (getSnapshot().selectedItemIds.includes(id)) return
      setSelection([id], id, id)
    },
    getSelectionSnapshot: getPublicSnapshot,
  }
}

function detachSelectionSnapshot(
  snapshot: FileSystemSelectionSnapshot,
): FileSystemSelectionSnapshot {
  return {
    selectedItemIds: [...snapshot.selectedItemIds],
    anchorItemId: snapshot.anchorItemId,
    focusedItemId: snapshot.focusedItemId,
  }
}

function toggleSelection(
  snapshot: FileSystemSelectionSnapshot,
  setSelection: SetFileSystemSelection,
  id: ResourceId,
) {
  const selectedItemIds = snapshot.selectedItemIds.includes(id)
    ? snapshot.selectedItemIds.filter((selectedId) => selectedId !== id)
    : [...snapshot.selectedItemIds, id]
  const anchorItemId =
    snapshot.anchorItemId && selectedItemIds.includes(snapshot.anchorItemId)
      ? snapshot.anchorItemId
      : (selectedItemIds[0] ?? null)

  setSelection(selectedItemIds, id, anchorItemId)
}

function selectRange(
  snapshot: FileSystemSelectionSnapshot,
  setSelection: SetFileSystemSelection,
  targetId: ResourceId,
  visibleItemIds: ReadonlyArray<ResourceId>,
) {
  const { anchorItemId, selectedItemIds } = resolveFileSystemSelectionRange({
    anchorId: snapshot.anchorItemId,
    fallbackAnchorId: snapshot.focusedItemId,
    targetId,
    visibleItemIds,
  })
  setSelection(selectedItemIds, targetId, anchorItemId)
}

function moveFocus(
  snapshot: FileSystemSelectionSnapshot,
  setSelection: SetFileSystemSelection,
  direction: 'up' | 'down',
  visibleItemIds: ReadonlyArray<ResourceId>,
  extendSelection: boolean,
) {
  const focusedItemId = getNextFileSystemFocusedItemId(
    snapshot.focusedItemId,
    direction,
    visibleItemIds,
  )
  if (!focusedItemId) return
  if (!extendSelection) {
    setSelection([focusedItemId], focusedItemId, focusedItemId)
    return
  }
  const { anchorItemId, selectedItemIds } = resolveFileSystemSelectionRange({
    anchorId: snapshot.anchorItemId,
    fallbackAnchorId: snapshot.focusedItemId,
    targetId: focusedItemId,
    visibleItemIds,
  })
  setSelection(selectedItemIds, focusedItemId, anchorItemId)
}
