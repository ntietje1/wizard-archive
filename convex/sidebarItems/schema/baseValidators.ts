import { v } from 'convex/values'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'

export const sidebarItemLocationValidator = v.union(
  v.literal(SIDEBAR_ITEM_LOCATION.sidebar),
  v.literal(SIDEBAR_ITEM_LOCATION.trash),
)

export const sidebarItemIdValidator = v.id('sidebarItems')

export const sidebarItemTypeValidator = v.union(
  v.literal(SIDEBAR_ITEM_TYPES.notes),
  v.literal(SIDEBAR_ITEM_TYPES.folders),
  v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  v.literal(SIDEBAR_ITEM_TYPES.files),
  v.literal(SIDEBAR_ITEM_TYPES.canvases),
)

export const permissionLevelValidator = v.union(
  v.literal('none'),
  v.literal('view'),
  v.literal('edit'),
  v.literal('full_access'),
)
