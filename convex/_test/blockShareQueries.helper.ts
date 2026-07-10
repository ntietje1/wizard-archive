import { api } from '../_generated/api'
import type { TestConvexForDataModel } from 'convex-test'
import type { DataModel, Id } from '../_generated/dataModel'
import type { NoteBlockId } from '@wizard-archive/editor/notes/document-contract'

type AuthedContext = TestConvexForDataModel<DataModel>

export async function getBlockShareInfo(
  auth: AuthedContext,
  {
    campaignId,
    noteId,
    blockNoteId,
  }: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
    blockNoteId: NoteBlockId
  },
) {
  const result = await auth.query(api.blocks.queries.getBlocksWithShares, {
    campaignId,
    noteId,
    blockNoteIds: [blockNoteId],
  })
  return result.blocks[0]
}
