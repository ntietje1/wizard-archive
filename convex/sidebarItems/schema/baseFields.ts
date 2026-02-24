import { v } from 'convex/values'
import { sidebarItemShareValidator } from '../../shares/schema'
import { commonTableFields } from '../../common/schema'
import {
  permissionLevelValidator,
  sidebarItemTypeValidator,
} from './baseValidators'

export const commonSidebarItemTableFields = {
  name: v.optional(v.string()),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.optional(v.string()),
  color: v.optional(v.string()),
  type: sidebarItemTypeValidator,
  parentId: v.optional(v.id('folders')),
  allPermissionLevel: v.optional(permissionLevelValidator),
  ...commonTableFields,
}

export const commonSidebarItemValidatorFields = {
  ...commonSidebarItemTableFields,
  shares: v.optional(v.array(sidebarItemShareValidator)),
  isBookmarked: v.optional(v.boolean()),
  myPermissionLevel: v.optional(permissionLevelValidator),
} // TODO: potentially make these required
