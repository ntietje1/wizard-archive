import { createResourceReadModel } from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceStatus } from '@wizard-archive/editor/resources/resource-contract'
import type { OperationPlannerItem } from '@wizard-archive/editor/resources/operation-contract'
import type { Id } from '../../_generated/dataModel'

type SidebarOperationReadModelRow = {
  _id: Id<'sidebarItems'>
  parentId: Id<'sidebarItems'> | null
  status: ResourceStatus
}

type SidebarOperationPlannerRow = SidebarOperationReadModelRow &
  Pick<OperationPlannerItem, 'name' | 'type'>

function toSidebarOperationNode(item: SidebarOperationReadModelRow) {
  return {
    id: item._id,
    parentId: item.parentId,
    status: item.status,
  }
}

export function toSidebarOperationItem(item: SidebarOperationPlannerRow): OperationPlannerItem {
  return {
    ...toSidebarOperationNode(item),
    name: item.name,
    type: item.type,
  }
}

export function toSidebarOperationItems(
  items: ReadonlyArray<SidebarOperationPlannerRow>,
): Array<OperationPlannerItem> {
  return items.map(toSidebarOperationItem)
}

export function createSidebarOperationReadModel<T extends SidebarOperationReadModelRow>({
  items,
  childrenMap,
}: {
  items: ReadonlyArray<T>
  childrenMap: ReadonlyMap<Id<'sidebarItems'>, ReadonlyArray<T>>
}) {
  const rowsById = new Map<Id<'sidebarItems'>, ReturnType<typeof toSidebarOperationNode>>()
  const includeRow = (item: SidebarOperationReadModelRow) => {
    if (rowsById.has(item._id)) return
    rowsById.set(item._id, toSidebarOperationNode(item))
  }

  for (const item of items) {
    includeRow(item)
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      includeRow(child)
    }
  }

  const model = createResourceReadModel(Array.from(rowsById.values()))
  return {
    itemsById: model.resourcesById,
  }
}
