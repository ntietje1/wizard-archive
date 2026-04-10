import { v } from 'convex/values'
import { commonSidebarItemValidatorFields } from '../sidebarItems/schema/baseFields'
import { commonValidatorFields } from '../common/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { folderValidator } from '../folders/baseSchema'

const fileValidatorFields = {
  ...commonValidatorFields('sidebarItems'),
  ...commonSidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.files),
  storageId: v.union(v.id('_storage'), v.null()),
  downloadUrl: v.union(v.string(), v.null()),
  contentType: v.union(v.string(), v.null()),
}

export const fileValidator = v.object(fileValidatorFields)

export const fileWithContentValidator = v.object({
  ...fileValidatorFields,
  ancestors: v.array(folderValidator),
})
