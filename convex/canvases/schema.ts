import { v } from 'convex/values'
import { folderValidator } from '../folders/baseSchema'
import { canvasValidatorFields } from './baseSchema'

export const canvasWithContentValidator = v.object({
  ...canvasValidatorFields,
  ancestors: v.array(folderValidator),
})
