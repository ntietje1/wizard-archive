import { api } from '../_generated/api'
import type { TestConvexForDataModel } from 'convex-test'
import type { DataModel } from '../_generated/dataModel'
import type {
  CampaignId,
  NoteBlockId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'

type AuthedContext = TestConvexForDataModel<DataModel>

export async function getBlockShareInfo(
  auth: AuthedContext,
  {
    campaignId,
    noteId,
    blockNoteId,
  }: {
    campaignId: CampaignId
    noteId: ResourceId
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
