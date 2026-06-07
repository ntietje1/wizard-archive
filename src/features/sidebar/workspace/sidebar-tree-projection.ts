import type { SidebarTreeSurfaceItem } from '~/features/sidebar/components/sidebar-tree-surface'

interface SidebarTreeProjectionRow extends Omit<SidebarTreeSurfaceItem, 'children'> {
  parentId?: string | null
}

export function buildSidebarTreeSurfaceItems(
  rows: ReadonlyArray<SidebarTreeProjectionRow>,
): Array<SidebarTreeSurfaceItem> {
  const itemsById = new Map<string, SidebarTreeSurfaceItem>()

  for (const row of rows) {
    itemsById.set(row.id, sidebarTreeSurfaceItemForRow(row))
  }

  const roots: Array<SidebarTreeSurfaceItem> = []

  for (const row of rows) {
    const item = itemsById.get(row.id)
    if (!item) continue

    const parent = row.parentId ? itemsById.get(row.parentId) : undefined

    if (!parent) {
      roots.push(item)
      continue
    }

    parent.children = [...(parent.children ?? []), item]
  }

  return roots
}

function sidebarTreeSurfaceItemForRow(row: SidebarTreeProjectionRow): SidebarTreeSurfaceItem {
  const { parentId: _parentId, ...item } = row
  return item
}
