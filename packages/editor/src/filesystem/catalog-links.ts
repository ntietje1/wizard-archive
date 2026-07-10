import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ItemLink } from './search'

interface CatalogItemLinkRow {
  id: string
  query: string
  displayName: string | null
  item: { id: SidebarItemId; name: string } | null
}

export function createCatalogItemLink(row: CatalogItemLinkRow): ItemLink {
  return {
    id: row.id,
    query: row.query,
    displayName: row.displayName,
    item: row.item
      ? {
          id: row.item.id,
          name: row.item.name,
        }
      : null,
  }
}
