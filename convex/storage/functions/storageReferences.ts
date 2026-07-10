import type { Id } from '../../_generated/dataModel'
import type { DatabaseReader } from '../../_generated/server'

export async function isStorageReferencedByCampaignContent(
  db: Pick<DatabaseReader, 'query'>,
  storageId: Id<'_storage'>,
) {
  const [file, map, previewItem] = await Promise.all([
    db
      .query('files')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .first(),
    db
      .query('gameMaps')
      .withIndex('by_imageStorageId', (q) => q.eq('imageStorageId', storageId))
      .first(),
    db
      .query('sidebarItems')
      .withIndex('by_previewStorageId', (q) => q.eq('previewStorageId', storageId))
      .first(),
  ])

  return file !== null || map !== null || previewItem !== null
}
