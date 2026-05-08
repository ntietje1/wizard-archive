import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DuplicateOperation, MoveOperation } from 'convex/sidebarItems/operations/types'

export type SidebarCacheSnapshot = {
  sidebar: Array<AnySidebarItem>
  trash: Array<AnySidebarItem>
}

type MoveItemOrReplaceOperation = Extract<MoveOperation, { action: 'move' | 'replace' }>

function getDescendantIds(folderId: Id<'sidebarItems'>, items: Array<AnySidebarItem>) {
  const descendants = new Set<Id<'sidebarItems'>>()
  const visit = (parentId: Id<'sidebarItems'>) => {
    for (const child of items) {
      if (child.parentId !== parentId) continue
      descendants.add(child._id)
      if (child.type === SIDEBAR_ITEM_TYPES.folders) {
        visit(child._id)
      }
    }
  }
  visit(folderId)
  return descendants
}

function trashItemTreeInSnapshot(
  itemId: Id<'sidebarItems'>,
  sidebar: Array<AnySidebarItem>,
  trash: Array<AnySidebarItem>,
  now: number,
) {
  const item = sidebar.find((candidate) => candidate._id === itemId)
  if (!item) return { sidebar, trash }
  const descendantIds =
    item.type === SIDEBAR_ITEM_TYPES.folders ? getDescendantIds(item._id, sidebar) : new Set()
  const movedItems = sidebar.filter(
    (candidate) => candidate._id === item._id || descendantIds.has(candidate._id),
  )
  return {
    sidebar: sidebar.filter(
      (candidate) => candidate._id !== item._id && !descendantIds.has(candidate._id),
    ),
    trash: [
      ...movedItems.map((candidate) => ({
        ...candidate,
        parentId: candidate._id === item._id ? null : candidate.parentId,
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: now,
        deletedBy: null,
      })),
      ...trash,
    ] as Array<AnySidebarItem>,
  }
}

function trashItemTreeInState(
  state: SidebarCacheSnapshot,
  itemId: Id<'sidebarItems'>,
  now: number,
) {
  const next = trashItemTreeInSnapshot(itemId, state.sidebar, state.trash, now)
  state.sidebar = next.sidebar
  state.trash = next.trash
}

function restoreItemTreeInState(
  state: SidebarCacheSnapshot,
  source: AnySidebarItem,
  operation: MoveItemOrReplaceOperation,
) {
  const descendantIds =
    source.type === SIDEBAR_ITEM_TYPES.folders
      ? getDescendantIds(source._id, state.trash)
      : new Set()
  const restoredItems = state.trash.filter(
    (candidate) => candidate._id === source._id || descendantIds.has(candidate._id),
  )

  state.trash = state.trash.filter(
    (candidate) => candidate._id !== source._id && !descendantIds.has(candidate._id),
  )
  state.sidebar = [
    ...state.sidebar,
    ...restoredItems.map((candidate) => ({
      ...candidate,
      parentId: candidate._id === source._id ? operation.targetParentId : candidate.parentId,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      deletionTime: null,
      deletedBy: null,
    })),
  ] as Array<AnySidebarItem>
}

function moveSidebarItemInState(
  state: SidebarCacheSnapshot,
  source: AnySidebarItem,
  operation: MoveItemOrReplaceOperation,
) {
  state.sidebar = state.sidebar.map((candidate) =>
    candidate._id === source._id
      ? ({
          ...candidate,
          parentId: operation.targetParentId,
          ...(operation.name ? { name: operation.name } : {}),
        } as AnySidebarItem)
      : candidate,
  )
}

function findSnapshotItem(state: SidebarCacheSnapshot, itemId: Id<'sidebarItems'>) {
  const sourceInSidebar = state.sidebar.find((item) => item._id === itemId)
  const sourceInTrash = state.trash.find((item) => item._id === itemId)
  return { source: sourceInSidebar ?? sourceInTrash, sourceInTrash }
}

function applyOptimisticMoveOperation(
  state: SidebarCacheSnapshot,
  operation: MoveOperation,
  now: number,
) {
  if (operation.action === 'skip') return
  if (operation.action === 'replace' && operation.destinationItemId) {
    trashItemTreeInState(state, operation.destinationItemId, now)
  }
  if (operation.action === 'mergeFolder') {
    const hasChildren = state.sidebar.some(
      (candidate) => candidate.parentId === operation.sourceItemId,
    )
    if (!hasChildren) {
      trashItemTreeInState(state, operation.sourceItemId, now)
    }
    return
  }

  const { source, sourceInTrash } = findSnapshotItem(state, operation.sourceItemId)
  if (!source) return

  if (sourceInTrash) {
    restoreItemTreeInState(state, source, operation)
    return
  }

  moveSidebarItemInState(state, source, operation)
}

export function applyOptimisticMoveOperationsToSnapshot(
  snapshot: SidebarCacheSnapshot,
  operations: Array<MoveOperation>,
  now = Date.now(),
): SidebarCacheSnapshot {
  const state = {
    sidebar: [...snapshot.sidebar],
    trash: [...snapshot.trash],
  }

  for (const operation of operations) {
    applyOptimisticMoveOperation(state, operation, now)
  }

  return state
}

export function applyOptimisticTrashItemsToSnapshot(
  snapshot: SidebarCacheSnapshot,
  items: Array<AnySidebarItem>,
  now = Date.now(),
): SidebarCacheSnapshot {
  let sidebar = [...snapshot.sidebar]
  let trash = [...snapshot.trash]

  for (const item of items) {
    const next = trashItemTreeInSnapshot(item._id, sidebar, trash, now)
    sidebar = next.sidebar
    trash = next.trash
  }

  return { sidebar, trash }
}

export function applyOptimisticPermanentDeleteItemsToSnapshot(
  snapshot: SidebarCacheSnapshot,
  items: Array<AnySidebarItem>,
): SidebarCacheSnapshot {
  const deletedIds = new Set<Id<'sidebarItems'>>()

  for (const item of items) {
    deletedIds.add(item._id)
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      for (const descendantId of getDescendantIds(item._id, snapshot.trash)) {
        deletedIds.add(descendantId)
      }
    }
  }

  return {
    sidebar: snapshot.sidebar,
    trash: snapshot.trash.filter((item) => !deletedIds.has(item._id)),
  }
}

export function applyOptimisticDuplicateOperationsToSnapshot(
  snapshot: SidebarCacheSnapshot,
  operations: Array<DuplicateOperation>,
  now = Date.now(),
): SidebarCacheSnapshot {
  let sidebar = [...snapshot.sidebar]
  let trash = [...snapshot.trash]
  let tempIndex = 0

  const trashDestination = (itemId: Id<'sidebarItems'>) => {
    const next = trashItemTreeInSnapshot(itemId, sidebar, trash, now)
    sidebar = next.sidebar
    trash = next.trash
  }

  const cloneTree = (source: AnySidebarItem, parentId: Id<'sidebarItems'> | null, name: string) => {
    const index = tempIndex++
    const tempId = `optimistic-${source._id}-${now}-${index}` as Id<'sidebarItems'>
    const clone = {
      ...source,
      _id: tempId,
      name,
      slug: `${source.slug}-optimistic-${index}` as AnySidebarItem['slug'],
      parentId,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      deletionTime: null,
      deletedBy: null,
    } as AnySidebarItem
    sidebar.push(clone)
    if (source.type !== SIDEBAR_ITEM_TYPES.folders) return tempId
    for (const child of snapshot.sidebar.filter((candidate) => candidate.parentId === source._id)) {
      cloneTree(child, tempId, child.name)
    }
    return tempId
  }

  const snapshotSidebarMap = new Map(snapshot.sidebar.map((item) => [item._id, item]))
  for (const operation of operations) {
    if (operation.action === 'skip') continue
    if (operation.action === 'replace' && operation.destinationItemId) {
      trashDestination(operation.destinationItemId)
    }
    if (operation.action === 'mergeFolder') continue
    const source = snapshotSidebarMap.get(operation.sourceItemId)
    if (!source) continue
    cloneTree(source, operation.targetParentId ?? null, operation.name ?? source.name)
  }

  return { sidebar, trash }
}
