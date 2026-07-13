import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import { api } from '../_generated/api'
import type { DataModel, Id } from '../_generated/dataModel'
import type schema from '../schema'
import { createFolder, createNote, testBlockNoteId } from './factories.helper'
import { makeYjsUpdateWithBlocks } from './yjs.helper'

type T = TestConvex<typeof schema>
type AuthedContext = TestConvexForDataModel<DataModel>

export async function setupSiblingRelativeNoteLink(
  t: T,
  client: AuthedContext,
  args: {
    campaignId: Id<'campaigns'>
    creatorProfileId: Id<'userProfiles'>
  },
) {
  const { folderId: folderA } = await createFolder(t, args.campaignId, args.creatorProfileId, {
    name: 'Folder A',
  })
  const { folderId: folderB } = await createFolder(t, args.campaignId, args.creatorProfileId, {
    name: 'Folder B',
  })
  const { noteId: targetId } = await createNote(t, args.campaignId, args.creatorProfileId, {
    name: 'Target',
    parentId: folderA,
  })
  const { noteId: sourceId } = await createNote(t, args.campaignId, args.creatorProfileId, {
    name: 'Source',
    parentId: folderA,
  })

  await client.mutation(api.yjsSync.mutations.pushUpdate, {
    campaignId: args.campaignId,
    documentId: sourceId,
    update: makeYjsUpdateWithBlocks([
      {
        id: testBlockNoteId('block-a'),
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '[[./Target]]', styles: {} }],
        children: [],
      },
    ]),
  })
  await client.action(api.notes.actions.persistNoteBlocks, {
    campaignId: args.campaignId,
    documentId: sourceId,
  })

  return { folderA, folderB, sourceId, targetId }
}

export async function getNoteLinksForSource(
  t: T,
  campaignId: Id<'campaigns'>,
  sourceNoteId: Id<'sidebarItems'>,
) {
  return await t.run(async (dbCtx) => {
    return await dbCtx.db
      .query('noteLinks')
      .withIndex('by_campaign_source', (q) =>
        q.eq('campaignId', campaignId).eq('sourceNoteId', sourceNoteId),
      )
      .collect()
  })
}
