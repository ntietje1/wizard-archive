import { v } from 'convex/values'
import { sidebarItemShareValidator } from '../../shares/schema'
import {
  sidebarItemShareStatusValidator,
  sidebarItemTypeValidator,
} from './baseValidators'

export const sidebarItemTableFields = {
  name: v.optional(v.string()),
  slug: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.optional(v.string()),
  color: v.optional(v.string()),
  type: sidebarItemTypeValidator,
  parentId: v.optional(v.id('folders')),
  updatedAt: v.number(),
  shareStatus: v.optional(sidebarItemShareStatusValidator),
}

export const sidebarItemBaseFields = {
  ...sidebarItemTableFields,
  shares: v.optional(v.array(sidebarItemShareValidator)),
  isBookmarked: v.optional(v.boolean()),
}
