import { v } from 'convex/values'
import { customBlockValidator } from '../blocks/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { noteValidator } from '../notes/schema'
import { mapValidator } from '../gameMaps/baseSchema'
import { fileValidator } from '../files/schema'
import { folderValidator, folderValidatorFields } from './baseSchema'

const folderChildValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator,
  fileValidator,
)

export const folderWithContentValidator = v.object({
  ...folderValidatorFields,
  ancestors: v.array(folderValidator),
  children: v.array(folderChildValidator),
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
