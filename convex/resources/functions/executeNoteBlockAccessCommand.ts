import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import {
  accessCommandInputRejection,
  RESOURCE_COMMAND_PROTOCOL_VERSION,
  fingerprintNoteBlockAccessCommand,
  normalizeNoteBlockAccessCommand,
} from '@wizard-archive/editor/resources/command-protocol'
import type {
  NoteBlockAccessCommand,
  NoteBlockAccessCommandResult,
  NoteBlockAccessReceipt,
} from '@wizard-archive/editor/resources/command-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { NoteBlockId, OperationId } from '@wizard-archive/editor/resources/domain-id'
import { NOTE_BLOCK_VISIBILITY } from '@wizard-archive/editor/resources/note-block-access-policy'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { findNoteContent } from './noteContent'
import { flattenNoteBlockIds } from './noteBlockAccess'
import { isAcceptedCampaignPlayer } from './campaignPlayer'
import { accessOperationWasReused, findAccessOperation } from './accessOperation'
import { recordItemHistoryEvent } from './itemHistory'

type PlannedWrite =
  | { type: 'insertAudience'; blockId: NoteBlockId }
  | { type: 'deleteAudience'; row: Doc<'noteBlockAudienceAccess'> }
  | {
      type: 'insertMember'
      blockId: NoteBlockId
      memberId: Extract<NoteBlockAccessCommand, { type: 'setNoteBlockMemberAccess' }>['memberId']
      visibility: 'hidden' | 'visible'
    }
  | {
      type: 'patchMember'
      row: Doc<'noteBlockMemberAccess'>
      visibility: 'hidden' | 'visible'
    }
  | { type: 'deleteMember'; row: Doc<'noteBlockMemberAccess'> }

export async function executeNoteBlockAccessCommand(
  ctx: CampaignMutationCtx,
  operationId: OperationId,
  commandInput: NoteBlockAccessCommand,
): Promise<NoteBlockAccessCommandResult> {
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'rejected', reason: 'unauthorized' }
  }
  const normalized = normalizeCommand(commandInput)
  if (normalized.status === 'rejected') return normalized
  const command = normalized.command

  const [fingerprint, stored] = await Promise.all([
    fingerprintNoteBlockAccessCommand(command),
    findAccessOperation(ctx, 'noteBlockAccessOperations', operationId),
  ])
  if (stored) {
    return accessOperationWasReused(stored, ctx.resourceScope.actorId, fingerprint)
      ? { status: 'rejected', reason: 'operation_id_reused' }
      : { status: 'completed', receipt: receiptFromRow(stored.receipt) }
  }

  const target = await loadCommandTarget(ctx, command)
  if (target.status === 'rejected') return target
  const writes = await planWrites(ctx, command)
  await Promise.all(writes.map((write) => applyWrite(ctx, command.noteId, write)))
  await recordBlockAccessHistory(ctx, command, writes)

  const receipt: NoteBlockAccessReceipt = {
    campaignId: ctx.resourceScope.campaignId,
    operationId,
    noteId: command.noteId,
    blockIds: command.blockIds,
  }
  await ctx.db.insert('noteBlockAccessOperations', {
    campaignUuid: ctx.resourceScope.campaignId,
    actorMemberUuid: ctx.resourceScope.actorId,
    operationUuid: operationId,
    protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
    fingerprint,
    receipt: storedReceipt(receipt),
  })
  return { status: 'completed', receipt }
}

async function recordBlockAccessHistory(
  ctx: CampaignMutationCtx,
  command: NoteBlockAccessCommand,
  writes: ReadonlyArray<PlannedWrite>,
): Promise<void> {
  if (writes.length === 0) return
  const subject = command.type === 'setNoteBlockAudienceAccess' ? 'all_players' : command.memberId
  if (command.type === 'setNoteBlockAudienceAccess') {
    await recordBlockVisibility(ctx, command.noteId, writes.length, subject, command.shared)
    return
  }
  if (command.type === 'setNoteBlockMemberAccess') {
    await recordBlockVisibility(
      ctx,
      command.noteId,
      writes.length,
      subject,
      command.permission === 'view',
    )
    return
  }
  const visible = await Promise.all(
    writes.map(async (write) => {
      if (write.type !== 'deleteMember') {
        throw new TypeError('Cleared block access plan is corrupt')
      }
      return (
        (await ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note_and_block', (query) =>
            query
              .eq('campaignUuid', ctx.resourceScope.campaignId)
              .eq('noteUuid', command.noteId)
              .eq('blockUuid', write.row.blockUuid),
          )
          .unique()) !== null
      )
    }),
  )
  const visibleCount = visible.filter(Boolean).length
  await Promise.all([
    ...(visibleCount === 0
      ? []
      : [recordBlockVisibility(ctx, command.noteId, visibleCount, subject, true)]),
    ...(visibleCount === writes.length
      ? []
      : [recordBlockVisibility(ctx, command.noteId, writes.length - visibleCount, subject, false)]),
  ])
}

async function recordBlockVisibility(
  ctx: CampaignMutationCtx,
  noteId: NoteBlockAccessCommand['noteId'],
  blockCount: number,
  subject:
    | 'all_players'
    | Extract<NoteBlockAccessCommand, { type: 'setNoteBlockMemberAccess' }>['memberId'],
  visible: boolean,
) {
  await recordItemHistoryEvent(ctx, noteId, {
    action: ITEM_HISTORY_ACTION.blockVisibilityChanged,
    metadata: { blockCount, subject, visible },
  })
}

function normalizeCommand(command: NoteBlockAccessCommand) {
  try {
    return {
      status: 'ready' as const,
      command: normalizeNoteBlockAccessCommand(command),
    }
  } catch (error) {
    return {
      status: 'rejected' as const,
      reason: accessCommandInputRejection(error),
    }
  }
}

async function loadCommandTarget(ctx: CampaignMutationCtx, command: NoteBlockAccessCommand) {
  const note = await findCanonicalResource(ctx.db, command.noteId)
  if (!note || note.kind !== 'note') {
    return { status: 'rejected' as const, reason: 'note_missing' as const }
  }
  if (note.campaignUuid !== ctx.resourceScope.campaignId || note.lifecycle !== 'active') {
    return { status: 'rejected' as const, reason: 'ownership_mismatch' as const }
  }
  if (
    command.type !== 'setNoteBlockAudienceAccess' &&
    !(await isAcceptedCampaignPlayer(ctx, command.memberId))
  ) {
    return { status: 'rejected' as const, reason: 'invalid_command' as const }
  }
  const content = await findNoteContent(ctx.db, command.noteId)
  if (!content) return { status: 'rejected' as const, reason: 'note_missing' as const }
  const knownBlockIds = decodeBlockIds(content.update)
  if (!knownBlockIds) return { status: 'rejected' as const, reason: 'content_corrupt' as const }
  if (command.blockIds.some((blockId) => !knownBlockIds.has(blockId))) {
    return { status: 'rejected' as const, reason: 'block_missing' as const }
  }
  return { status: 'ready' as const }
}

function decodeBlockIds(update: ArrayBuffer): Set<NoteBlockId> | null {
  try {
    return new Set(
      flattenNoteBlockIds(decodeNoteYjsUpdatesToBlocks([{ update }], NOTE_YJS_FRAGMENT)),
    )
  } catch {
    return null
  }
}

async function planWrites(
  ctx: CampaignMutationCtx,
  command: NoteBlockAccessCommand,
): Promise<Array<PlannedWrite>> {
  switch (command.type) {
    case 'setNoteBlockAudienceAccess':
      return await planAudienceWrites(ctx, command)
    case 'setNoteBlockMemberAccess':
    case 'clearNoteBlockMemberAccess':
      return await planMemberWrites(ctx, command)
  }
}

async function planAudienceWrites(
  ctx: CampaignMutationCtx,
  command: Extract<NoteBlockAccessCommand, { type: 'setNoteBlockAudienceAccess' }>,
) {
  const rows = await Promise.all(
    command.blockIds.map((blockId) =>
      ctx.db
        .query('noteBlockAudienceAccess')
        .withIndex('by_note_and_block', (query) =>
          query
            .eq('campaignUuid', ctx.resourceScope.campaignId)
            .eq('noteUuid', command.noteId)
            .eq('blockUuid', blockId),
        )
        .unique(),
    ),
  )
  const writes: Array<PlannedWrite> = []
  for (const [index, row] of rows.entries()) {
    if (command.shared && !row) {
      writes.push({ type: 'insertAudience', blockId: command.blockIds[index]! })
    } else if (!command.shared && row) {
      writes.push({ type: 'deleteAudience', row })
    }
  }
  return writes
}

async function planMemberWrites(
  ctx: CampaignMutationCtx,
  command: Exclude<NoteBlockAccessCommand, { type: 'setNoteBlockAudienceAccess' }>,
) {
  const rows = await Promise.all(
    command.blockIds.map((blockId) =>
      ctx.db
        .query('noteBlockMemberAccess')
        .withIndex('by_block_and_member', (query) =>
          query
            .eq('campaignUuid', ctx.resourceScope.campaignId)
            .eq('noteUuid', command.noteId)
            .eq('blockUuid', blockId)
            .eq('memberUuid', command.memberId),
        )
        .unique(),
    ),
  )
  if (command.type === 'clearNoteBlockMemberAccess') {
    return rows.flatMap((row) => (row ? [{ type: 'deleteMember' as const, row }] : []))
  }
  return planSetMemberWrites(command, rows)
}

function planSetMemberWrites(
  command: Extract<NoteBlockAccessCommand, { type: 'setNoteBlockMemberAccess' }>,
  rows: ReadonlyArray<Doc<'noteBlockMemberAccess'> | null>,
) {
  const visibility =
    command.permission === 'view' ? NOTE_BLOCK_VISIBILITY.visible : NOTE_BLOCK_VISIBILITY.hidden
  const writes: Array<PlannedWrite> = []
  for (const [index, row] of rows.entries()) {
    if (!row) {
      writes.push({
        type: 'insertMember',
        blockId: command.blockIds[index]!,
        memberId: command.memberId,
        visibility,
      })
    } else if (row.visibility !== visibility) {
      writes.push({ type: 'patchMember', row, visibility })
    }
  }
  return writes
}

async function applyWrite(
  ctx: CampaignMutationCtx,
  noteId: NoteBlockAccessCommand['noteId'],
  write: PlannedWrite,
): Promise<void> {
  switch (write.type) {
    case 'insertAudience':
      await ctx.db.insert('noteBlockAudienceAccess', {
        campaignUuid: ctx.resourceScope.campaignId,
        noteUuid: noteId,
        blockUuid: write.blockId,
      })
      return
    case 'deleteAudience':
    case 'deleteMember':
      await ctx.db.delete(write.row._id)
      return
    case 'insertMember':
      await ctx.db.insert('noteBlockMemberAccess', {
        campaignUuid: ctx.resourceScope.campaignId,
        noteUuid: noteId,
        blockUuid: write.blockId,
        memberUuid: write.memberId,
        visibility: write.visibility,
      })
      return
    case 'patchMember':
      await ctx.db.patch(write.row._id, { visibility: write.visibility })
  }
}

function storedReceipt(receipt: NoteBlockAccessReceipt) {
  return {
    campaignId: receipt.campaignId,
    operationId: receipt.operationId,
    noteId: receipt.noteId,
    blockIds: [...receipt.blockIds],
  }
}

function receiptFromRow(
  receipt: Doc<'noteBlockAccessOperations'>['receipt'],
): NoteBlockAccessReceipt {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, receipt.campaignId),
    operationId: assertDomainId(DOMAIN_ID_KIND.operation, receipt.operationId),
    noteId: assertDomainId(DOMAIN_ID_KIND.resource, receipt.noteId),
    blockIds: receipt.blockIds.map((blockId) => assertDomainId(DOMAIN_ID_KIND.noteBlock, blockId)),
  }
}
