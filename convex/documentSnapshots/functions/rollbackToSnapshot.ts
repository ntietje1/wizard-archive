import {
  EDIT_HISTORY_ACTION,
  HISTORY_ROLLBACK_REJECTION_REASON,
} from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { rollbackNote } from '../../notes/functions/rollbackNote'
import { rollbackCanvas } from '../../canvases/functions/rollbackCanvas'
import { rollbackGameMap } from '../../gameMaps/functions/rollbackGameMap'
import { encodeGameMapSnapshot } from '../../gameMaps/functions/captureGameMapSnapshot'
import { getYjsDocumentRevision } from '../../yjsSync/functions/documentRevision'
import { logEditHistory } from '../../editHistory/log'
import { createSnapshot } from './createSnapshot'
import { resolveHistorySnapshot } from './getSnapshot'
import { DOCUMENT_SNAPSHOT_TYPE } from '../types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { RollbackServerResult } from '../rollback'
import type { HistorySnapshotResolution } from './getSnapshot'

type RollbackCurrentState =
  | {
      kind: 'yjs'
      data: ArrayBuffer
      expectedRevision: number
      expectedSeq: number
    }
  | { kind: 'game-map' }

type ReadyHistorySnapshot = Extract<HistorySnapshotResolution, { status: 'ready' }>
type YjsRollbackCurrentState = Extract<RollbackCurrentState, { kind: 'yjs' }>

export async function rollbackToSnapshot(
  ctx: CampaignMutationCtx,
  {
    currentState,
    editHistoryId,
  }: {
    currentState: RollbackCurrentState
    editHistoryId: Id<'editHistory'>
  },
): Promise<RollbackServerResult> {
  const resolution = await resolveHistorySnapshot(ctx, { editHistoryId })
  if (resolution.status === 'rejected') return resolution

  const currentData = await captureCurrentState(ctx, resolution, currentState)
  if (currentData === null) return contentChanged()

  const preservedHistoryEntryId = await recordPreservedState(ctx, resolution, currentData)
  await restoreSnapshot(ctx, resolution, currentState)

  await ctx.db.patch('sidebarItems', resolution.historyEntry.itemId, {
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  const historyEntryId = await recordRestoredState(ctx, resolution)

  return {
    status: 'restored',
    historyEntryId,
    preservedHistoryEntryId,
    restoredFromHistoryEntryId: resolution.historyEntry.historyEntryUuid,
    restoredItemId: resolution.historyEntry.itemId,
  }
}

async function captureCurrentState(
  ctx: CampaignMutationCtx,
  resolution: ReadyHistorySnapshot,
  currentState: RollbackCurrentState,
): Promise<ArrayBuffer | null> {
  if (resolution.historyEntry.itemType === RESOURCE_TYPES.gameMaps) {
    if (currentState.kind !== 'game-map') return null
    return await encodeGameMapSnapshot(ctx, {
      mapId: resolution.historyEntry.itemId,
      campaignId: ctx.campaign._id,
    })
  }
  if (currentState.kind !== 'yjs') return null

  const [latest, revision] = await Promise.all([
    ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', resolution.historyEntry.itemId))
      .order('desc')
      .first(),
    getYjsDocumentRevision(ctx, resolution.historyEntry.itemId),
  ])
  return (latest?.seq ?? -1) === currentState.expectedSeq &&
    revision === currentState.expectedRevision
    ? currentState.data
    : null
}

async function restoreSnapshot(
  ctx: CampaignMutationCtx,
  resolution: ReadyHistorySnapshot,
  currentState: RollbackCurrentState,
) {
  const { historyEntry, snapshot } = resolution
  if (historyEntry.itemType === RESOURCE_TYPES.gameMaps) {
    await rollbackGameMap(ctx, historyEntry.itemId, snapshot.data)
    return
  }

  const plan = requireYjsCurrentState(currentState)
  const expected = { revision: plan.expectedRevision, seq: plan.expectedSeq }
  const restored =
    historyEntry.itemType === RESOURCE_TYPES.notes
      ? await rollbackNote(ctx, historyEntry.itemId, snapshot.data, expected)
      : await rollbackCanvas(ctx, historyEntry.itemId, snapshot.data, expected)
  if (!restored) throw new Error('Yjs document changed after rollback validation')
}

function requireYjsCurrentState(currentState: RollbackCurrentState): YjsRollbackCurrentState {
  if (currentState.kind !== 'yjs') {
    throw new Error('Yjs rollback requires a Yjs current-state plan')
  }
  return currentState
}

async function recordPreservedState(
  ctx: CampaignMutationCtx,
  resolution: ReadyHistorySnapshot,
  data: ArrayBuffer,
) {
  const historyEntry = await logEditHistory(
    ctx,
    {
      itemId: resolution.historyEntry.itemId,
      itemType: resolution.historyEntry.itemType,
      action: EDIT_HISTORY_ACTION.content_edited,
    },
    { hasSnapshot: true },
  )
  await createHistorySnapshot(ctx, {
    data,
    editHistoryId: historyEntry.rowId,
    itemId: resolution.historyEntry.itemId,
    itemType: resolution.historyEntry.itemType,
  })
  return historyEntry.id
}

async function recordRestoredState(ctx: CampaignMutationCtx, resolution: ReadyHistorySnapshot) {
  const historyEntry = await logEditHistory(
    ctx,
    {
      itemId: resolution.historyEntry.itemId,
      itemType: resolution.historyEntry.itemType,
      action: EDIT_HISTORY_ACTION.rolled_back,
      metadata: { restoredFromHistoryEntryId: resolution.historyEntry.historyEntryUuid },
    },
    { hasSnapshot: true },
  )
  await createHistorySnapshot(ctx, {
    data: resolution.snapshot.data,
    editHistoryId: historyEntry.rowId,
    itemId: resolution.historyEntry.itemId,
    itemType: resolution.historyEntry.itemType,
  })
  return historyEntry.id
}

async function createHistorySnapshot(
  ctx: CampaignMutationCtx,
  args: {
    data: ArrayBuffer
    editHistoryId: Id<'editHistory'>
    itemId: Id<'sidebarItems'>
    itemType: string
  },
) {
  switch (args.itemType) {
    case RESOURCE_TYPES.notes:
    case RESOURCE_TYPES.canvases:
      await createSnapshot(ctx, {
        ...args,
        itemType: args.itemType,
        campaignId: ctx.campaign._id,
        snapshotType: DOCUMENT_SNAPSHOT_TYPE.YjsState,
      })
      return
    case RESOURCE_TYPES.gameMaps:
      await createSnapshot(ctx, {
        ...args,
        itemType: args.itemType,
        campaignId: ctx.campaign._id,
        snapshotType: DOCUMENT_SNAPSHOT_TYPE.GameMap,
      })
      return
    default:
      throw new Error(`Cannot snapshot unsupported rollback item type ${args.itemType}`)
  }
}

function contentChanged(): RollbackServerResult {
  return { status: 'rejected', reason: HISTORY_ROLLBACK_REJECTION_REASON.contentChanged }
}
