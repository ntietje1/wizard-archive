import { v } from 'convex/values'
import {
  sidebarItemColorValidator,
  sidebarItemIconNameValidator,
  permissionLevelValidator,
  sidebarItemLocationValidator,
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
  sidebarItemStatusValidator,
  sidebarItemTypeValidator,
} from './validators'

export const sidebarItemTableFields = {
  name: sidebarItemNameValidator,
  slug: sidebarItemSlugValidator,
  campaignId: v.id('campaigns'),
  iconName: v.nullable(sidebarItemIconNameValidator),
  color: v.nullable(sidebarItemColorValidator),
  type: sidebarItemTypeValidator,
  parentId: v.nullable(v.id('sidebarItems')),
  allPermissionLevel: v.nullable(permissionLevelValidator),
  location: sidebarItemLocationValidator,
  status: sidebarItemStatusValidator,
  previewStorageId: v.nullable(v.id('_storage')),
  previewLockedUntil: v.nullable(v.number()),
  previewClaimToken: v.nullable(v.string()),
  previewUpdatedAt: v.nullable(v.number()),
  updatedTime: v.nullable(v.number()),
  updatedBy: v.nullable(v.id('userProfiles')),
  createdBy: v.id('userProfiles'),
  deletionTime: v.nullable(v.number()),
  deletedBy: v.nullable(v.id('userProfiles')),
}
