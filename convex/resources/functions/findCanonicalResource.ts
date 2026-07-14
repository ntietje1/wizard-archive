import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { GenericDatabaseReader } from 'convex/server'
import type { DataModel } from '../../_generated/dataModel'

export async function findCanonicalResource(
  db: GenericDatabaseReader<DataModel>,
  resourceId: ResourceId,
) {
  return await db
    .query('resources')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}
