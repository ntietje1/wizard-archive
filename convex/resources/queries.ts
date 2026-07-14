import type { ResourceCollectionQuery } from '@wizard-archive/editor/resources/index-contract'
import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import {
  loadAuthorizedCollection,
  loadAuthorizedResource,
} from './functions/projectAuthorizedResources'
import {
  authorizedResourceSnapshotValidator,
  resourceCollectionQueryValidator,
  resourceUuidValidator,
} from './schema'

type StoredAuthorizedResourceSnapshot = Infer<typeof authorizedResourceSnapshotValidator>

const authorizedResourceCollectionPageValidator = v.object({
  snapshot: authorizedResourceSnapshotValidator,
  cursor: v.nullable(resourceUuidValidator),
})

type StoredAuthorizedResourceCollectionPage = Infer<
  typeof authorizedResourceCollectionPageValidator
>

export const loadResource = campaignQuery({
  args: { resourceId: resourceUuidValidator },
  returns: authorizedResourceSnapshotValidator,
  handler: async (ctx, args): Promise<StoredAuthorizedResourceSnapshot> => {
    return (await loadAuthorizedResource(
      ctx,
      args.resourceId,
    )) as unknown as StoredAuthorizedResourceSnapshot
  },
})

export const loadCollection = campaignQuery({
  args: {
    query: resourceCollectionQueryValidator,
    cursor: v.optional(v.nullable(resourceUuidValidator)),
  },
  returns: authorizedResourceCollectionPageValidator,
  handler: async (ctx, args): Promise<StoredAuthorizedResourceCollectionPage> => {
    return (await loadAuthorizedCollection(ctx, {
      query: args.query as unknown as ResourceCollectionQuery,
      cursor: args.cursor ?? null,
    })) as unknown as StoredAuthorizedResourceCollectionPage
  },
})
