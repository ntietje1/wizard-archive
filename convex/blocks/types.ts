import type { ShareStatus } from '../blockShares/types'
import type { Id, Doc } from '../_generated/dataModel'

export type BlockShareInfo = {
  blockNoteId: string
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
  isTopLevel: boolean
}

export type Block = Doc<'blocks'>
