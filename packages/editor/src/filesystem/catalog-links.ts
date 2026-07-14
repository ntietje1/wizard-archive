import type { ResourceId } from '../resources/domain-id'
import type { ItemLink } from './search'

interface CatalogItemLinkRow {
  id: string
  query: string
  displayName: string | null
  item: { id: ResourceId; name: string } | null
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
