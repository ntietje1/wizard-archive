import { v } from 'convex/values'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { folderValidator } from '../folders/baseSchema'

const fileValidatorFields = {
  ...sidebarItemValidatorFields,
  type: v.literal(SIDEBAR_ITEM_TYPES.files),
  storageId: v.nullable(v.id('_storage')),
  downloadUrl: v.nullable(v.string()),
  contentType: v.nullable(v.string()),
}

export const fileValidator = v.object(fileValidatorFields)

export const fileWithContentValidator = v.object({
  ...fileValidatorFields,
  ancestors: v.array(folderValidator),
})
