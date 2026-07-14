import { v } from 'convex/values'
import {
  permissionLevelValidator,
  sidebarItemIconNameValidator,
  sidebarItemLocationValidator,
  sidebarItemStatusValidator,
  sidebarItemTypeValidator,
} from './validators'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { campaignMemberIdValidator } from '../../campaigns/schema'

export const sidebarItemTableFields = {
  resourceUuid: v.string(),
  name: v.string(),
  normalizedName: v.string(),
  campaignId: v.id('campaigns'),
  iconName: v.nullable(sidebarItemIconNameValidator),
  color: v.nullable(v.string()),
  type: sidebarItemTypeValidator,
  parentId: v.nullable(v.id('sidebarItems')),
  allPermissionLevel: v.nullable(permissionLevelValidator),
  location: sidebarItemLocationValidator,
  status: sidebarItemStatusValidator,
  previewStorageId: v.nullable(v.id('_storage')),
  previewUpdatedAt: v.nullable(v.number()),
  updatedTime: v.nullable(v.number()),
  updatedBy: v.nullable(campaignMemberIdValidator),
  createdBy: campaignMemberIdValidator,
  deletionTime: v.nullable(v.number()),
  deletedBy: v.nullable(campaignMemberIdValidator),
}

const {
  status: _status,
  deletionTime: _deletionTime,
  deletedBy: _deletedBy,
  ...sidebarItemCommonTableFields
} = sidebarItemTableFields

export const sidebarItemTableValidator = v.union(
  v.object({
    ...sidebarItemCommonTableFields,
    status: v.literal(RESOURCE_STATUS.active),
    deletionTime: v.null(),
    deletedBy: v.null(),
  }),
  v.object({
    ...sidebarItemCommonTableFields,
    status: v.literal(RESOURCE_STATUS.undoHidden),
    deletionTime: v.null(),
    deletedBy: v.null(),
  }),
  v.object({
    ...sidebarItemCommonTableFields,
    status: v.literal(RESOURCE_STATUS.trashed),
    deletionTime: v.number(),
    deletedBy: campaignMemberIdValidator,
  }),
)
