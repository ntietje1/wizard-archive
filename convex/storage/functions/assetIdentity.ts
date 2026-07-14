import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { AssetId } from '@wizard-archive/editor/resources/domain-id'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

type AssetIdentityDb = QueryCtx['db']

export async function getAssetIdByStorageId(
  db: AssetIdentityDb,
  storageId: Id<'_storage'> | null,
): Promise<AssetId | null> {
  if (storageId === null) return null
  const upload = await db
    .query('fileStorage')
    .withIndex('by_storage', (query) => query.eq('storageId', storageId))
    .unique()
  if (!upload?.assetUuid) throw new Error('Storage object is missing its asset identity')
  return assertDomainId(DOMAIN_ID_KIND.asset, upload.assetUuid)
}

export async function getStorageIdByAssetId(
  db: AssetIdentityDb,
  assetId: AssetId | string | null,
): Promise<Id<'_storage'> | null> {
  if (assetId === null) return null
  const canonicalAssetId = assertDomainId(DOMAIN_ID_KIND.asset, assetId)
  const upload = await db
    .query('fileStorage')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', canonicalAssetId))
    .unique()
  return upload?.storageId ?? null
}
