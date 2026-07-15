import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  NoteBlockId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import {
  parseSerializedAuthoredDestination,
  remapAuthoredDestination,
  serializeAuthoredDestination,
} from '@wizard-archive/editor/resources/authored-destination'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
  noteBlocksToYDoc,
} from '@wizard-archive/editor/notes/document-yjs'
import type { CampaignMutationCtx } from '../../functions'
import type { GenericDatabaseReader } from 'convex/server'
import type { DataModel } from '../../_generated/dataModel'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { encodeYjsDocument, resourceReferencesAreValid } from './contentCopyTypes'
import { initialBinaryContentVersion } from './contentVersion'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { findCanonicalResource } from './findCanonicalResource'

export type NoteResourceValidation =
  | Readonly<{ status: 'valid'; resourceId: ResourceId }>
  | Readonly<{
      status: 'rejected'
      reason: 'invalid_uuid' | 'resource_missing' | 'ownership_mismatch' | 'wrong_kind'
    }>

export async function validateNoteResource(
  ctx: CampaignMutationCtx,
  value: string,
): Promise<NoteResourceValidation> {
  let resourceId: ResourceId
  try {
    resourceId = assertDomainId(DOMAIN_ID_KIND.resource, value)
  } catch {
    return { status: 'rejected', reason: 'invalid_uuid' }
  }
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource) return { status: 'rejected', reason: 'resource_missing' }
  if (resource.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'rejected', reason: 'ownership_mismatch' }
  }
  return resource.kind === 'note'
    ? { status: 'valid', resourceId }
    : { status: 'rejected', reason: 'wrong_kind' }
}

export async function findNoteContent(
  db: GenericDatabaseReader<DataModel>,
  resourceId: ResourceId,
) {
  return await db
    .query('resourceNoteContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

export async function createNoteContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
  operationId: OperationId,
  update: ArrayBuffer,
  version: VersionStamp,
): Promise<'completed' | 'operation_id_reused'> {
  const existing = await findNoteContent(ctx.db, resourceId)
  if (existing) {
    if (
      existing.campaignUuid === campaignId &&
      existing.creationOperationUuid === operationId &&
      existing.version.digest === version.digest
    ) {
      return 'completed'
    }
    return 'operation_id_reused'
  }
  await ctx.db.insert('resourceNoteContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    creationOperationUuid: operationId,
    update,
    version,
  })
  return 'completed'
}

export async function prepareNoteContentCreation(
  update: ArrayBuffer,
): Promise<VersionStamp | null> {
  try {
    decodeNoteYjsUpdatesToBlocks([{ update }], NOTE_YJS_FRAGMENT)
    return await initialBinaryContentVersion(update)
  } catch {
    return null
  }
}

export async function loadNoteContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  return await findNoteContent(ctx.db, resourceId)
}

type AllocatedNoteBlock = Readonly<{ sourceId: NoteBlockId; block: NoteBlock }>

export async function prepareNoteContentCopy(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  sourceResourceId: ResourceId,
  destinationResourceId: ResourceId,
): Promise<ContentCopyPreparation> {
  const content = await findNoteContent(ctx.db, sourceResourceId)
  if (!content || content.campaignUuid !== campaignId) return { status: 'integrity_error' }

  let blocks: Array<NoteBlock>
  try {
    blocks = decodeNoteYjsUpdatesToBlocks([{ update: content.update }], NOTE_YJS_FRAGMENT)
  } catch {
    return { status: 'integrity_error' }
  }
  if (!(await noteReferencesAreValid(ctx, campaignId, blocks))) {
    return { status: 'integrity_error' }
  }

  const allocated: Array<AllocatedNoteBlock> = []
  const copiedBlocks = blocks.map((block) => allocateNoteBlock(block, allocated))
  const referenceableTargets = allocated.flatMap(({ sourceId, block }) => {
    const mappings: Array<CanonicalTargetMapEntry> = [
      {
        source: {
          kind: 'noteBlock',
          resourceId: sourceResourceId,
          blockId: sourceId,
          presentation: 'block',
        },
        destination: {
          kind: 'noteBlock',
          resourceId: destinationResourceId,
          blockId: block.id,
          presentation: 'block',
        },
      },
    ]
    if (block.type === 'heading') {
      mappings.push({
        source: {
          kind: 'noteBlock',
          resourceId: sourceResourceId,
          blockId: sourceId,
          presentation: 'heading',
        },
        destination: {
          kind: 'noteBlock',
          resourceId: destinationResourceId,
          blockId: block.id,
          presentation: 'heading',
        },
      })
    }
    return mappings
  })

  return {
    status: 'ready',
    plan: {
      referenceableTargets,
      finalize: async (targetMap) => {
        const finalized = copiedBlocks.map((block) => remapNoteBlockResources(block, targetMap))
        const update = encodeYjsDocument(noteBlocksToYDoc(finalized, NOTE_YJS_FRAGMENT))
        const version = await initialBinaryContentVersion(update)
        return async () => {
          await ctx.db.insert('resourceNoteContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            creationOperationUuid: operationId,
            update,
            version,
          })
        }
      },
    },
  }
}

function allocateNoteBlock(source: NoteBlock, allocated: Array<AllocatedNoteBlock>): NoteBlock {
  const block = {
    ...source,
    id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
    ...(source.children
      ? { children: source.children.map((child) => allocateNoteBlock(child, allocated)) }
      : {}),
  } as NoteBlock
  allocated.push({ sourceId: source.id, block })
  return block
}

function noteResourceIds(blocks: ReadonlyArray<NoteBlock>): Array<ResourceId> | null {
  const result: Array<ResourceId> = []
  const blockIds = new Set<NoteBlockId>()
  const pending = [...blocks]
  while (pending.length > 0) {
    const block = pending.pop()!
    if (blockIds.has(block.id)) return null
    blockIds.add(block.id)
    pending.push(...(block.children ?? []))
    if (block.type !== 'embed') continue
    const destination = parseSerializedAuthoredDestination(block.props.destination)
    if (!destination) return null
    if (destination.kind === 'internal') result.push(destination.target.resourceId)
  }
  return result
}

async function noteReferencesAreValid(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  blocks: ReadonlyArray<NoteBlock>,
): Promise<boolean> {
  const resourceIds = noteResourceIds(blocks)
  if (!resourceIds) return false
  return await resourceReferencesAreValid(ctx, campaignId, resourceIds)
}

function remapNoteBlockResources(
  block: NoteBlock,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
): NoteBlock {
  const props = block.type === 'embed' ? remapNoteEmbed(block, targetMap) : block.props
  return {
    ...block,
    props,
    ...(block.children
      ? { children: block.children.map((child) => remapNoteBlockResources(child, targetMap)) }
      : {}),
  } as NoteBlock
}

function remapNoteEmbed(
  block: Extract<NoteBlock, { type: 'embed' }>,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
) {
  const destination = parseSerializedAuthoredDestination(block.props.destination)
  if (!destination) throw new TypeError('Invalid authored destination')
  const result = remapAuthoredDestination(destination, targetMap, 'same_campaign_copy')
  if (result.status !== 'completed') throw new TypeError('Unmapped authored destination')
  return {
    ...block.props,
    destination: serializeAuthoredDestination(result.destination),
  }
}
