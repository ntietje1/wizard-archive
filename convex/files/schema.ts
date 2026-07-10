import { v } from 'convex/values'
import { sidebarItemValidatorFields } from '../sidebarItems/schema/sidebarItemsTable'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { folderValidator } from '../folders/baseSchema'

const fileValidatorFields = {
  ...sidebarItemValidatorFields,
  type: v.literal(RESOURCE_TYPES.files),
  assetId: v.nullable(v.id('_storage')),
  downloadUrl: v.nullable(v.string()),
  contentType: v.nullable(v.string()),
}

export const fileValidator = v.object(fileValidatorFields)

export const fileWithContentValidator = v.object({
  ...fileValidatorFields,
  ancestors: v.array(folderValidator),
})
