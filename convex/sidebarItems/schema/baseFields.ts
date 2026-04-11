import { v } from 'convex/values'
import { sidebarItemShareValidator } from '../../sidebarShares/schema'
import { commonTableFields } from '../../common/schema'
import {
  permissionLevelValidator,
  sidebarItemLocationValidator,
  sidebarItemTypeValidator,
} from './baseValidators'

export const commonSidebarItemTableFields = {
  name: v.string(),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.nullable(v.string()),
  color: v.nullable(v.string()),
  type: sidebarItemTypeValidator,
  parentId: v.nullable(v.id('sidebarItems')),
  allPermissionLevel: v.nullable(permissionLevelValidator),
  location: sidebarItemLocationValidator,
  previewStorageId: v.nullable(v.id('_storage')),
  previewLockedUntil: v.nullable(v.number()),
  previewClaimToken: v.nullable(v.string()),
  previewUpdatedAt: v.nullable(v.number()),
  ...commonTableFields,
}

export const commonSidebarItemValidatorFields = {
  ...commonSidebarItemTableFields,
  shares: v.array(sidebarItemShareValidator),
  isBookmarked: v.boolean(),
  myPermissionLevel: permissionLevelValidator,
  previewUrl: v.nullable(v.string()),
}
