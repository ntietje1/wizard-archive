import { noteBlocksPlainText } from '@wizard-archive/editor/notes/document-text'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import {
  createResourceSearchDocument,
  normalizeResourceSearchText,
} from '@wizard-archive/editor/resources/search-policy'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { resourceRecordFromRow } from './resourceRecordRow'

export async function syncResourceSearchProjection(
  ctx: CampaignMutationCtx,
  resource: ResourceRecord,
  body?: string,
): Promise<void> {
  const existing = await findResourceSearchDocument(ctx, resource.id)
  if (resource.lifecycle.state !== 'active') {
    if (existing) await ctx.db.delete(existing._id)
    return
  }
  const projectedBody =
    body ??
    existing?.body ??
    (resource.kind === 'note' ? await loadNoteSearchBody(ctx, resource.id) : '')
  const document = createResourceSearchDocument(resource.id, resource.title, projectedBody)
  const value = {
    campaignUuid: resource.campaignId,
    resourceUuid: resource.id,
    title: document.title,
    normalizedTitle: normalizeResourceSearchText(document.title),
    body: document.body,
  }
  if (existing) await ctx.db.replace('resourceSearchDocuments', existing._id, value)
  else await ctx.db.insert('resourceSearchDocuments', value)
}

export async function deleteResourceSearchProjection(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
): Promise<void> {
  const existing = await findResourceSearchDocument(ctx, resourceId)
  if (existing) await ctx.db.delete(existing._id)
}

export async function copyResourceSearchBody(
  ctx: CampaignMutationCtx,
  sourceResourceId: ResourceId,
  destination: ResourceRecord,
): Promise<void> {
  const source = await findResourceSearchDocument(ctx, sourceResourceId)
  await syncResourceSearchProjection(ctx, destination, source?.body ?? '')
}

export function noteSearchBody(update: ArrayBuffer): string {
  return noteBlocksPlainText(decodeNoteYjsUpdatesToBlocks([{ update }], NOTE_YJS_FRAGMENT))
}

export async function syncNoteSearchProjection(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  update: ArrayBuffer,
): Promise<void> {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource || resource.campaignUuid !== ctx.resourceScope.campaignId) {
    throw new TypeError('Note search projection resource is missing')
  }
  await syncResourceSearchProjection(ctx, resourceRecordFromRow(resource), noteSearchBody(update))
}

async function findResourceSearchDocument(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  return await ctx.db
    .query('resourceSearchDocuments')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

async function loadNoteSearchBody(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const content = await ctx.db
    .query('resourceNoteContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  return content ? noteSearchBody(content.update) : ''
}
