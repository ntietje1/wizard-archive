import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import { planTransferOperations } from '../../operation-contract'
import type { OperationPlannerItem } from '../../operation-contract'
import type { ResourceOperationDecision } from '../../transaction-contract'
import { createSidebarItem } from './test-sidebar-item'

type TransferPlanInput = Omit<
  Parameters<typeof planTransferOperations>[0],
  'itemsById' | 'mode'
> & {
  graphItems?: Array<OperationPlannerItem>
}

export function decisions(values: Record<string, ResourceOperationDecision['action']>) {
  return Object.entries(values).map(([sourceItemId, action]) => ({
    sourceItemId: sourceItemId as SidebarItemId,
    action,
  }))
}

export function createMergeFolderFixture({ withSourceRoot = false } = {}) {
  const sourceRoot = withSourceRoot
    ? createSidebarItem('source-root', 'Source Root', RESOURCE_TYPES.folders)
    : null
  const sourceFolder = createSidebarItem('folder-1', 'Scenes', RESOURCE_TYPES.folders, {
    parentId: sourceRoot?.id ?? null,
  })
  const destinationFolder = createSidebarItem('folder-2', 'Scenes', RESOURCE_TYPES.folders)
  const sourceChild = createSidebarItem('note-1', 'Ambush', RESOURCE_TYPES.notes, {
    parentId: sourceFolder.id,
  })
  const destinationChild = createSidebarItem('note-2', 'Ambush', RESOURCE_TYPES.notes, {
    parentId: destinationFolder.id,
  })
  const getChildren = (parentId: SidebarItemId) => {
    if (sourceRoot && parentId === sourceRoot.id) return [sourceFolder]
    if (parentId === sourceFolder.id) return [sourceChild]
    if (parentId === destinationFolder.id) return [destinationChild]
    return []
  }

  return {
    graphItems: sourceRoot ? [sourceRoot] : [],
    sourceRoot,
    sourceFolder,
    destinationFolder,
    sourceChild,
    destinationChild,
    getChildren,
  }
}

function buildTransferItemsById({
  getChildren,
  graphItems = [],
  items,
  targetItems,
}: TransferPlanInput) {
  const itemsById = new Map<SidebarItemId, OperationPlannerItem>()
  const visit = (plannerItem: OperationPlannerItem) => {
    if (itemsById.has(plannerItem.id)) return
    itemsById.set(plannerItem.id, plannerItem)
    for (const child of getChildren?.(plannerItem.id) ?? []) {
      visit(child)
    }
  }
  for (const root of [...items, ...targetItems, ...graphItems]) {
    visit(root)
  }
  return itemsById
}

export function planCopyTransfer(args: TransferPlanInput) {
  return planTransferOperations({
    ...args,
    mode: 'copy',
    itemsById: buildTransferItemsById(args),
  })
}

export function planMoveTransfer(args: TransferPlanInput) {
  return planTransferOperations({
    ...args,
    mode: 'move',
    itemsById: buildTransferItemsById(args),
  })
}
