import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import { api } from '../_generated/api'
import type { DataModel, Id } from '../_generated/dataModel'
import type schema from '../schema'
import { createFolder, createNote, testBlockNoteId } from './factories.helper'
import { makeYjsUpdateWithBlocks } from './yjs.helper'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { requireSidebarItemRow } from '../sidebarItems/functions/sidebarItemIdentity'

type T = TestConvex<typeof schema>
type AuthedContext = TestConvexForDataModel<DataModel>

export async function setupSiblingRelativeNoteLink(
  t: T,
  client: AuthedContext,
  args: {
    campaignId: Id<'campaigns'>
    campaignDomainId: CampaignId
    creatorProfileId: Id<'userProfiles'>
  },
) {
  const [folderAResult, folderBResult] = await Promise.all([
    createFolder(t, args.campaignId, args.creatorProfileId, { name: 'Folder A' }),
    createFolder(t, args.campaignId, args.creatorProfileId, { name: 'Folder B' }),
  ])
  const { folderId: folderA, folderRowId: folderARowId } = folderAResult
  const { folderId: folderB, folderRowId: folderBRowId } = folderBResult
  const [target, source] = await Promise.all([
    createNote(t, args.campaignId, args.creatorProfileId, {
      name: 'Target',
      parentId: folderA,
    }),
    createNote(t, args.campaignId, args.creatorProfileId, {
      name: 'Source',
      parentId: folderA,
    }),
  ])
  const { noteId: targetId, noteRowId: targetRowId } = target
  const { noteId: sourceId, noteRowId: sourceRowId } = source

  await client.mutation(api.yjsSync.mutations.pushUpdate, {
    campaignId: args.campaignDomainId,
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
    campaignId: args.campaignDomainId,
    documentId: sourceId,
  })

  return {
    folderA,
    folderARowId,
    folderB,
    folderBRowId,
    sourceId,
    sourceRowId,
    targetId,
    targetRowId,
  }
}

export async function getNoteLinksForSource(
  t: T,
  campaignId: Id<'campaigns'>,
  sourceNoteId: ResourceId,
) {
  return await t.run(async (dbCtx) => {
    const source = await requireSidebarItemRow(dbCtx, sourceNoteId)
    const links = await dbCtx.db
      .query('noteLinks')
      .withIndex('by_campaign_source', (q) =>
        q.eq('campaignId', campaignId).eq('sourceNoteId', source._id),
      )
      .collect()
    return await Promise.all(
      links.map(async (link) => ({
        ...link,
        targetItemId: link.targetItemId
          ? ((await dbCtx.db.get('sidebarItems', link.targetItemId))?.resourceUuid ?? null)
          : null,
      })),
    )
  })
}
