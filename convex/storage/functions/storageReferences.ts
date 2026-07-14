import type { AssetId } from '@wizard-archive/editor/resources/domain-id'
import type { DatabaseReader } from '../../_generated/server'

export async function isAssetOwnedByResource(db: Pick<DatabaseReader, 'query'>, assetId: AssetId) {
  return (
    (await db
      .query('resourceAssetOwners')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
      .first()) !== null
  )
}
