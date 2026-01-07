import { v } from 'convex/values'
import { mapValidator } from '../gameMaps/schema'
import { noteValidator } from '../notes/schema'
import { folderValidator } from '../folders/schema'
import { fileValidator } from '../files/schema'
import {
  sidebarItemBaseFields,
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from './baseFields'

export const anySidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator,
  fileValidator,
)

// Re-export for convenience
export {
  sidebarItemTypeValidator,
  sidebarItemIdValidator,
  sidebarItemBaseFields,
}
