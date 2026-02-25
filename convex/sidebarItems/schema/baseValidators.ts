import { v } from 'convex/values'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'

export const sidebarItemIdValidator = v.union(
  v.id('notes'),
  v.id('folders'),
  v.id('gameMaps'),
  v.id('files'),
)

export const sidebarItemTypeValidator = v.union(
  v.literal(SIDEBAR_ITEM_TYPES.notes),
  v.literal(SIDEBAR_ITEM_TYPES.folders),
  v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  v.literal(SIDEBAR_ITEM_TYPES.files),
)

export const permissionLevelValidator = v.union(
  v.literal('none'),
  v.literal('view'),
  v.literal('edit'),
  v.literal('full_access'),
)
