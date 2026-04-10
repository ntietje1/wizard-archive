import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { SidebarItemShare } from 'convex/sidebarShares/types'
import { testId } from '~/test/helpers/test-id'

let shareCounter = 0

export function createSidebarItemShare(overrides?: Partial<SidebarItemShare>): SidebarItemShare {
  shareCounter++
  return {
    _id: testId(`share_${shareCounter}`),
    _creationTime: 1700000000000,
    campaignId: testId('campaign_1'),
    sidebarItemId: testId<'sidebarItems'>('note_1'),
    sidebarItemType: SIDEBAR_ITEM_TYPES.notes,
    campaignMemberId: testId('member_1'),
    sessionId: null,
    permissionLevel: PERMISSION_LEVEL.VIEW,
    updatedTime: null,
    updatedBy: null,
    createdBy: testId('user_1'),
    deletionTime: null,
    deletedBy: null,
    ...overrides,
  }
}
