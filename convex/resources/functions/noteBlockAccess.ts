import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
  noteBlocksToYDoc,
} from '@wizard-archive/editor/notes/document-yjs'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import {
  NOTE_BLOCK_VISIBILITY,
  noteBlockIsVisible,
} from '@wizard-archive/editor/resources/note-block-access-policy'
import type {
  NoteBlockAccessParticipant,
  NoteBlockVisibility,
} from '@wizard-archive/editor/resources/note-block-access-policy'
import type { ResourcePermission } from '@wizard-archive/editor/resources/access-policy'
import type {
  CampaignMemberId,
  NoteBlockId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { encodeYjsDocument } from './contentCopyTypes'
import { findCanonicalResource } from './findCanonicalResource'
import { findNoteContent } from './noteContent'
import { projectResourceAccess } from './resourceAccess'

export async function projectNoteBlockAccess(
  ctx: CampaignQueryCtx,
  noteId: ResourceId,
  blockIds: ReadonlyArray<NoteBlockId>,
  participants: ReadonlyArray<
    Pick<NoteBlockAccessParticipant, 'id' | 'displayName' | 'username' | 'imageUrl'>
  >,
) {
  const loaded = await loadSelectedNoteBlockPolicies(ctx, noteId, blockIds, participants)
  if (!loaded) return null
  const access = await projectResourceAccess(ctx, noteId, participants)
  if (!access) return null
  const notePermissions = new Map(
    access.participants.map((participant) => [
      participant.id,
      participant.effectiveAccess.permission,
    ]),
  )
  return {
    noteId,
    blocks: blockIds.map((blockId) => ({
      blockId,
      audienceVisibility: loaded.audienceVisibility.get(blockId) ?? NOTE_BLOCK_VISIBILITY.hidden,
      memberAccess:
        loaded.memberVisibility
          .get(blockId)
          ?.map(([memberId, visibility]) => ({ memberId, visibility })) ?? [],
    })),
    participants: participants.map((participant) => ({
      ...participant,
      notePermission: notePermissions.get(participant.id)!,
    })),
  }
}

async function loadSelectedNoteBlockPolicies(
  ctx: CampaignQueryCtx,
  noteId: ResourceId,
  blockIds: ReadonlyArray<NoteBlockId>,
  participants: ReadonlyArray<Pick<NoteBlockAccessParticipant, 'id'>>,
) {
  const note = await loadCanonicalNoteBlocks(ctx, noteId)
  if (!note) return null
  const knownBlockIds = new Set(flattenNoteBlockIds(note.blocks))
  if (blockIds.some((blockId) => !knownBlockIds.has(blockId))) return null
  const [audienceRows, memberRows] = await Promise.all([
    Promise.all(
      blockIds.map((blockId) =>
        ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note_and_block', (query) =>
            query
              .eq('campaignUuid', ctx.resourceScope.campaignId)
              .eq('noteUuid', noteId)
              .eq('blockUuid', blockId),
          )
          .unique(),
      ),
    ),
    Promise.all(
      blockIds.flatMap((blockId) =>
        participants.map((participant) =>
          ctx.db
            .query('noteBlockMemberAccess')
            .withIndex('by_block_and_member', (query) =>
              query
                .eq('campaignUuid', ctx.resourceScope.campaignId)
                .eq('noteUuid', noteId)
                .eq('blockUuid', blockId)
                .eq('memberUuid', participant.id),
            )
            .unique(),
        ),
      ),
    ),
  ])
  const audienceVisibility = new Map<NoteBlockId, NoteBlockVisibility>(
    audienceRows.flatMap((row) =>
      row ? [[row.blockUuid, NOTE_BLOCK_VISIBILITY.visible] as const] : [],
    ),
  )
  const memberVisibility = new Map<
    NoteBlockId,
    Array<readonly [CampaignMemberId, NoteBlockVisibility]>
  >()
  for (const row of memberRows) {
    if (!row) continue
    const entries = memberVisibility.get(row.blockUuid) ?? []
    entries.push([row.memberUuid, row.visibility])
    memberVisibility.set(row.blockUuid, entries)
  }
  return { audienceVisibility, memberVisibility }
}

async function loadCanonicalNoteBlocks(ctx: CampaignQueryCtx, noteId: ResourceId) {
  const resource = await findCanonicalResource(ctx.db, noteId)
  if (
    !resource ||
    resource.campaignUuid !== ctx.resourceScope.campaignId ||
    resource.lifecycle !== 'active' ||
    resource.kind !== 'note'
  ) {
    return null
  }
  const content = await findNoteContent(ctx.db, noteId)
  if (!content) return null
  let blocks: Array<NoteBlock>
  try {
    blocks = decodeNoteYjsUpdatesToBlocks([{ update: content.update }], NOTE_YJS_FRAGMENT)
  } catch {
    return null
  }
  return { blocks, contentUpdate: content.update }
}

export async function filterNoteContentForMember(
  ctx: CampaignQueryCtx,
  noteId: ResourceId,
  memberId: CampaignMemberId,
  notePermission: ResourcePermission,
): Promise<
  { status: 'ready'; update: ArrayBuffer } | { status: 'empty' } | { status: 'integrity_error' }
> {
  const loaded = await loadNoteBlockPolicies(ctx, noteId)
  if (!loaded) return { status: 'integrity_error' }
  const visibleBlocks = filterVisibleBlocks(
    loaded.blocks,
    notePermission,
    loaded.audienceVisibility,
    loaded.memberVisibility,
    memberId,
  )
  if (visibleBlocks.length === 0) return { status: 'empty' }
  if (flattenNoteBlockIds(visibleBlocks).length === loaded.blockIds.length) {
    return { status: 'ready', update: loaded.contentUpdate }
  }
  return {
    status: 'ready',
    update: encodeYjsDocument(noteBlocksToYDoc(visibleBlocks, NOTE_YJS_FRAGMENT)),
  }
}

export function flattenNoteBlockIds(blocks: ReadonlyArray<NoteBlock>): Array<NoteBlockId> {
  return blocks.flatMap((block) => [block.id, ...flattenNoteBlockIds(block.children ?? [])])
}

async function loadNoteBlockPolicies(ctx: CampaignQueryCtx, noteId: ResourceId) {
  const note = await loadCanonicalNoteBlocks(ctx, noteId)
  if (!note) return null
  const { audienceRows, memberRows } = await loadNoteBlockAccessRows(
    ctx,
    ctx.resourceScope.campaignId,
    noteId,
  )
  const audienceVisibility = new Map<NoteBlockId, NoteBlockVisibility>(
    audienceRows.map((row) => [row.blockUuid, NOTE_BLOCK_VISIBILITY.visible]),
  )
  const memberVisibility = new Map<
    NoteBlockId,
    Array<readonly [CampaignMemberId, NoteBlockVisibility]>
  >()
  for (const row of memberRows) {
    const entries = memberVisibility.get(row.blockUuid) ?? []
    entries.push([row.memberUuid, row.visibility])
    memberVisibility.set(row.blockUuid, entries)
  }
  return {
    blocks: note.blocks,
    blockIds: flattenNoteBlockIds(note.blocks),
    contentUpdate: note.contentUpdate,
    audienceVisibility,
    memberVisibility,
  }
}

export async function loadNoteBlockAccessRows(
  ctx: Pick<CampaignMutationCtx | CampaignQueryCtx, 'db'>,
  campaignId: CampaignQueryCtx['resourceScope']['campaignId'],
  noteId: ResourceId,
) {
  const [audienceRows, memberRows] = await Promise.all([
    ctx.db
      .query('noteBlockAudienceAccess')
      .withIndex('by_note', (query) => query.eq('campaignUuid', campaignId).eq('noteUuid', noteId))
      .collect(),
    ctx.db
      .query('noteBlockMemberAccess')
      .withIndex('by_note', (query) => query.eq('campaignUuid', campaignId).eq('noteUuid', noteId))
      .collect(),
  ])
  return { audienceRows, memberRows }
}

function filterVisibleBlocks(
  blocks: ReadonlyArray<NoteBlock>,
  notePermission: ResourcePermission,
  audienceVisibility: ReadonlyMap<NoteBlockId, NoteBlockVisibility>,
  memberVisibility: ReadonlyMap<
    NoteBlockId,
    ReadonlyArray<readonly [CampaignMemberId, NoteBlockVisibility]>
  >,
  memberId: CampaignMemberId,
): Array<NoteBlock> {
  return blocks.flatMap((block) => {
    const audience = audienceVisibility.get(block.id) ?? NOTE_BLOCK_VISIBILITY.hidden
    const member = memberVisibility
      .get(block.id)
      ?.find(([candidateId]) => candidateId === memberId)?.[1]
    if (!noteBlockIsVisible(notePermission, audience, member)) return []
    const children = filterVisibleBlocks(
      block.children ?? [],
      notePermission,
      audienceVisibility,
      memberVisibility,
      memberId,
    )
    return [{ ...block, children }]
  })
}
