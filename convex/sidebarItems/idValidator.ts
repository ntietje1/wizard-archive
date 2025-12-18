import { v } from 'convex/values'

export const sidebarItemIdValidator = v.union(
  v.id('notes'),
  v.id('folders'),
  v.id('gameMaps'),
  v.id('tagCategories'),
  v.id('tags'),
)
