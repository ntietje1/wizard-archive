import { v } from 'convex/values'
import { sidebarItemShareValidator } from '../../sidebarShares/schema'
import { commonTableFields } from '../../common/schema'
import {
  permissionLevelValidator,
  sidebarItemTypeValidator,
} from './baseValidators'

export const commonSidebarItemTableFields = {
  name: v.string(),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.union(v.string(), v.null()),
  color: v.union(v.string(), v.null()),
  type: sidebarItemTypeValidator,
  parentId: v.union(v.id('folders'), v.null()),
  allPermissionLevel: v.union(permissionLevelValidator, v.null()),
  ...commonTableFields,
}

export const commonSidebarItemValidatorFields = {
  ...commonSidebarItemTableFields,
  shares: v.optional(v.array(sidebarItemShareValidator)),
  isBookmarked: v.optional(v.boolean()),
  myPermissionLevel: v.optional(permissionLevelValidator),
} // TODO: potentially make these required
