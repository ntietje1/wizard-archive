import { vi } from 'vitest'
import { api } from '../_generated/api'
import { createGameMap, createNote } from './factories.helper'
import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import type { DataModel, Doc, Id } from '../_generated/dataModel'
import type { GameMapSnapshotData } from '@wizard-archive/editor/game-maps/document-contract'
import type { HistoryEntryId } from '@wizard-archive/editor/resources/domain-id'
import type schema from '../schema'

type T = TestConvex<typeof schema>
type AuthedContext = TestConvexForDataModel<DataModel>
type TestDb = Parameters<Parameters<TestConvexForDataModel<DataModel>['run']>[0]>[0]['db']

export async function createSnapshotPin(
  t: T,
  client: AuthedContext,
  args: {
    campaignId: Id<'campaigns'>
    mapId: Id<'sidebarItems'>
    itemId: Id<'sidebarItems'>
    x: number
    y: number
    flushScheduledFunctions?: boolean
  },
) {
  const pinIds = await client.mutation(api.gameMaps.mutations.createItemPins, {
    campaignId: args.campaignId,
    mapId: args.mapId,
    pins: [{ itemId: args.itemId, x: args.x, y: args.y }],
  })

  if (args.flushScheduledFunctions ?? true) {
    await t.finishAllScheduledFunctions(vi.runAllTimers)
  }

  return pinIds
}

export async function createMapWithTwoSnapshotPins(
  t: T,
  client: AuthedContext,
  args: {
    campaignId: Id<'campaigns'>
    ownerId: Id<'userProfiles'>
  },
) {
  const { mapId } = await createGameMap(t, args.campaignId, args.ownerId)
  const { noteId: firstNoteId } = await createNote(t, args.campaignId, args.ownerId)
  const { noteId: secondNoteId } = await createNote(t, args.campaignId, args.ownerId)

  await createSnapshotPin(t, client, {
    campaignId: args.campaignId,
    mapId,
    itemId: firstNoteId,
    x: 10,
    y: 20,
  })

  await createSnapshotPin(t, client, {
    campaignId: args.campaignId,
    mapId,
    itemId: secondNoteId,
    x: 30,
    y: 40,
  })

  return { mapId, firstNoteId, secondNoteId }
}

export async function getEditHistoryEntryByItemAction(
  db: TestDb,
  itemId: Id<'sidebarItems'>,
  action: Doc<'editHistory'>['action'],
) {
  return await db
    .query('editHistory')
    .withIndex('by_item_action', (q) => q.eq('itemId', itemId).eq('action', action))
    .first()
}

export async function getSnapshotForEditHistoryEntry(db: TestDb, editHistoryId: Id<'editHistory'>) {
  return await db
    .query('documentSnapshots')
    .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
    .first()
}

export async function getEditHistoryEntryByUuid(db: TestDb, historyEntryId: HistoryEntryId) {
  return await db
    .query('editHistory')
    .withIndex('by_historyEntryUuid', (q) => q.eq('historyEntryUuid', historyEntryId))
    .unique()
}

export function parseGameMapSnapshotData(
  snapshot: Doc<'documentSnapshots'>,
  label: string,
): GameMapSnapshotData {
  try {
    return JSON.parse(new TextDecoder().decode(snapshot.data))
  } catch (error) {
    throw new Error(
      `Failed to parse game map snapshot ${label} (id=${snapshot._id}, createdAt=${snapshot._creationTime}): ${String(error)}`,
    )
  }
}
