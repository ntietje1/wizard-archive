import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { sidebarItemNameValueSchema } from '../sharedValidation'
export { sidebarItemSlugValidator } from '../slug'

export const sidebarItemNameValidator = zodToConvex(sidebarItemNameValueSchema)

export const sidebarItemLocationValidator = v.union(
  v.literal(SIDEBAR_ITEM_LOCATION.sidebar),
  v.literal(SIDEBAR_ITEM_LOCATION.trash),
)

export const sidebarItemTypeValidator = v.union(
  v.literal(SIDEBAR_ITEM_TYPES.notes),
  v.literal(SIDEBAR_ITEM_TYPES.folders),
  v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
  v.literal(SIDEBAR_ITEM_TYPES.files),
  v.literal(SIDEBAR_ITEM_TYPES.canvases),
)

export const permissionLevelValidator = v.union(
  v.literal(PERMISSION_LEVEL.NONE),
  v.literal(PERMISSION_LEVEL.VIEW),
  v.literal(PERMISSION_LEVEL.EDIT),
  v.literal(PERMISSION_LEVEL.FULL_ACCESS),
)
