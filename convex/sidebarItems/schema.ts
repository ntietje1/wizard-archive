import { v } from 'convex/values'
import { mapValidator } from '../gameMaps/schema'
import { noteValidator } from '../notes/schema'
import { folderValidator } from '../folders/schema'
import { tagCategoryValidator, tagValidator } from '../tags/schema'

export const anySidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator,
  tagCategoryValidator,
  tagValidator,
)

export const sidebarItemTypeValidator = v.union(
  v.literal('notes'),
  v.literal('folders'),
  v.literal('gameMaps'),
  v.literal('tagCategories'),
  v.literal('tags'),
)
