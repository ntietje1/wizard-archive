import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  NoteBlockId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import {
  noteAuthoredDestinationOccurrences,
  noteAuthoredDestinations,
  remapNoteAuthoredDestinations,
} from '@wizard-archive/editor/notes/authored-destinations'
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
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { initialNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import type { AuthoredDestinationOccurrence } from '@wizard-archive/editor/resources/authored-destination'
import { projectReferenceOccurrences } from '@wizard-archive/editor/resources/authored-destination'
import { replaceResourceReferenceProjection } from './resourceReferences'

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
  occurrences: ReadonlyArray<AuthoredDestinationOccurrence>,
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
  if (
    (
      await replaceResourceReferenceProjection(ctx, {
        campaignId,
        sourceResourceId: resourceId,
        sourceVersion: version,
        occurrences,
      })
    ).status !== 'completed'
  ) {
    throw new RangeError('Note reference projection exceeds its bound')
  }
  return 'completed'
}

export async function prepareNoteContentCreation(
  update: ArrayBuffer,
  resourceId: ResourceId,
): Promise<Readonly<{
  version: VersionStamp
  occurrences: ReadonlyArray<AuthoredDestinationOccurrence>
}> | null> {
  try {
    const blocks = decodeNoteYjsUpdatesToBlocks([{ update }], NOTE_YJS_FRAGMENT)
    const version = await initialNoteContentVersion(new Uint8Array(update))
    const occurrences = noteAuthoredDestinationOccurrences(blocks)
    projectReferenceOccurrences(resourceId, version, occurrences)
    return { version, occurrences }
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
        const remapped = remapNoteAuthoredDestinations(
          copiedBlocks,
          targetMap,
          'same_campaign_copy',
        )
        if (remapped.status !== 'completed') throw new TypeError('Unmapped authored destination')
        const finalized = remapped.blocks
        const update = encodeYjsDocument(noteBlocksToYDoc(finalized, NOTE_YJS_FRAGMENT))
        const version = await initialNoteContentVersion(new Uint8Array(update))
        return async () => {
          await ctx.db.insert('resourceNoteContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            creationOperationUuid: operationId,
            update,
            version,
          })
          if (
            (
              await replaceResourceReferenceProjection(ctx, {
                campaignId,
                sourceResourceId: destinationResourceId,
                sourceVersion: version,
                occurrences: noteAuthoredDestinationOccurrences(finalized),
              })
            ).status !== 'completed'
          ) {
            throw new RangeError('Copied note reference projection exceeds its bound')
          }
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
  try {
    return noteAuthoredDestinations(blocks).flatMap((destination) =>
      destination.kind === 'internal' ? [destination.target.resourceId] : [],
    )
  } catch {
    return null
  }
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
