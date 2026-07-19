import { noteBlocksPlainText } from '@wizard-archive/editor/notes/document-text'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import { noteDocumentOutline } from '@wizard-archive/editor/notes/outline'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import { createResourcePreview } from '@wizard-archive/editor/resources/preview'
import type { ResourcePreview } from '@wizard-archive/editor/resources/editor-runtime-contract'
import {
  createResourceSearchDocument,
  normalizeResourceSearchText,
} from '@wizard-archive/editor/resources/search-policy'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'
import { findCanonicalResource } from './findCanonicalResource'
import { resourceRecordFromRow } from './resourceRecordRow'

export async function syncResourceSearchProjection(
  ctx: CampaignMutationCtx,
  resource: ResourceRecord,
  noteProjection?: Readonly<{ body: string; preview: ResourcePreview }>,
): Promise<void> {
  const existing = await findResourceSearchDocument(ctx, resource.id)
  if (resource.lifecycle.state !== 'active') {
    if (existing) await ctx.db.delete(existing._id)
    return
  }
  const projectedNote =
    resource.kind === 'note'
      ? (noteProjection ??
        (existing
          ? { body: existing.body, preview: resourcePreviewFromRow(existing.preview) }
          : await loadNoteSearchProjection(ctx, resource.id)))
      : null
  const projectedBody = projectedNote?.body ?? ''
  const document = createResourceSearchDocument(resource.id, resource.title, projectedBody)
  const value = {
    campaignUuid: resource.campaignId,
    resourceUuid: resource.id,
    title: document.title,
    normalizedTitle: normalizeResourceSearchText(document.title),
    body: document.body,
    preview: storedPreview(projectedNote?.preview ?? createResourcePreview(resource.kind, '', [])),
  }
  if (existing) await ctx.db.replace('resourceSearchDocuments', existing._id, value)
  else await ctx.db.insert('resourceSearchDocuments', value)
}

function storedPreview(preview: ResourcePreview) {
  return {
    ...preview,
    outline: preview.outline.map((heading) => ({ ...heading })),
  }
}

function resourcePreviewFromRow(
  preview: Doc<'resourceSearchDocuments'>['preview'],
): ResourcePreview {
  return {
    ...preview,
    outline: preview.outline.map((heading) => ({
      ...heading,
      blockId: assertDomainId(DOMAIN_ID_KIND.noteBlock, heading.blockId),
    })),
  }
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
  await syncResourceSearchProjection(
    ctx,
    destination,
    source
      ? { body: source.body, preview: resourcePreviewFromRow(source.preview) }
      : { body: '', preview: createResourcePreview('note', '', []) },
  )
}

export function projectNoteSearchDocument(update: ArrayBuffer) {
  const blocks = decodeNoteYjsUpdatesToBlocks([{ update }], NOTE_YJS_FRAGMENT)
  const body = noteBlocksPlainText(blocks)
  return { body, preview: createResourcePreview('note', body, noteDocumentOutline(blocks)) }
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
  await syncResourceSearchProjection(
    ctx,
    resourceRecordFromRow(resource),
    projectNoteSearchDocument(update),
  )
}

async function findResourceSearchDocument(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  return await ctx.db
    .query('resourceSearchDocuments')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

async function loadNoteSearchProjection(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const content = await ctx.db
    .query('resourceNoteContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  return content
    ? projectNoteSearchDocument(content.update)
    : { body: '', preview: createResourcePreview('note', '', []) }
}
