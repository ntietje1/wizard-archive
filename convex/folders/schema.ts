import { v } from 'convex/values'
import { customBlockValidator } from '../blocks/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { folderValidator, folderValidatorFields } from './baseSchema'

export const folderWithContentValidator = v.object({
  ...folderValidatorFields,
  ancestors: v.array(folderValidator),
})

export const downloadableItemValidator = v.union(
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.files),
    id: v.id('files'),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.notes),
    id: v.id('notes'),
    name: v.string(),
    path: v.string(),
    content: v.array(customBlockValidator),
  }),
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
    id: v.id('gameMaps'),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
)
