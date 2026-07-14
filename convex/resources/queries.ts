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
  noteContentSnapshotValidator,
  resourceCollectionQueryValidator,
  resourceUuidValidator,
} from './schema'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { loadNoteContent as loadNoteContentFn } from './functions/loadNoteContent'

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

export const loadNoteContent = campaignQuery({
  args: { resourceId: resourceUuidValidator },
  returns: noteContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadNoteContentFn(ctx, resourceId)
  },
})
