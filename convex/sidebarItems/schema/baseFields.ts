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
  iconName: v.union(v.string(), v.null()),
  color: v.union(v.string(), v.null()),
  type: sidebarItemTypeValidator,
  parentId: v.union(v.id('sidebarItems'), v.null()),
  allPermissionLevel: v.union(permissionLevelValidator, v.null()),
  location: sidebarItemLocationValidator,
  previewStorageId: v.union(v.id('_storage'), v.null()),
  previewLockedUntil: v.union(v.number(), v.null()),
  previewClaimToken: v.union(v.string(), v.null()),
  previewUpdatedAt: v.union(v.number(), v.null()),
  ...commonTableFields,
}

export const commonSidebarItemValidatorFields = {
  ...commonSidebarItemTableFields,
  shares: v.array(sidebarItemShareValidator),
  isBookmarked: v.boolean(),
  myPermissionLevel: permissionLevelValidator,
  previewUrl: v.union(v.string(), v.null()),
}
