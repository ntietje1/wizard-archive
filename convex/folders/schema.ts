import { v } from 'convex/values'
import { folderValidator, folderValidatorFields } from './baseSchema'

export const folderWithContentValidator = v.object({
  ...folderValidatorFields,
  ancestors: v.array(folderValidator),
})
