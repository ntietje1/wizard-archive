import { v } from 'convex/values'
import { mapValidator } from '../gameMaps/schema'
import { noteValidator } from '../notes/schema'
import { folderValidator } from '../folders/schema'
import { tagCategoryValidator, tagValidator } from '../tags/schema'
import { fileValidator } from '../files/schema'
import { sidebarItemBaseFields, sidebarItemIdValidator, sidebarItemTypeValidator } from './baseFields'

export const anySidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator,
  tagCategoryValidator,
  tagValidator,
  fileValidator,
)

// Re-export for convenience
export { sidebarItemTypeValidator, sidebarItemIdValidator, sidebarItemBaseFields }

