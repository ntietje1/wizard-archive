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
  resourceContentSnapshotValidator,
  resourceCollectionQueryValidator,
} from './schema'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { loadNoteContent as loadNoteContentFn } from './functions/loadNoteContent'
import { loadResourceContent as loadResourceContentFn } from './functions/loadResourceContent'
import { resourceIdValidator } from './validators'

type StoredAuthorizedResourceSnapshot = Infer<typeof authorizedResourceSnapshotValidator>

const authorizedResourceCollectionPageValidator = v.object({
  snapshot: authorizedResourceSnapshotValidator,
  cursor: v.nullable(v.string()),
})

type StoredAuthorizedResourceCollectionPage = Infer<
  typeof authorizedResourceCollectionPageValidator
>

export const loadResource = campaignQuery({
  args: { resourceId: resourceIdValidator },
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
    cursor: v.optional(v.nullable(v.string())),
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
  args: { resourceId: resourceIdValidator },
  returns: noteContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadNoteContentFn(ctx, resourceId)
  },
})

export const loadContent = campaignQuery({
  args: {
    resourceId: resourceIdValidator,
    kind: v.union(v.literal('file'), v.literal('map'), v.literal('canvas')),
  },
  returns: resourceContentSnapshotValidator,
  handler: async (ctx, args) => {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    return await loadResourceContentFn(ctx, resourceId, args.kind)
  },
})
