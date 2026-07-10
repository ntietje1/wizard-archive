import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import {
  RESOURCE_ICON_NAMES,
  RESOURCE_LOCATION,
  RESOURCE_STATUS_VALUES,
  RESOURCE_TYPE_VALUES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'

export const sidebarItemLocationValidator = v.literal(RESOURCE_LOCATION.sidebar)

export const sidebarItemStatusValidator = literals(...RESOURCE_STATUS_VALUES)

export const sidebarItemTypeValidator = literals(...RESOURCE_TYPE_VALUES)

export const sidebarItemIconNameValidator = literals(...RESOURCE_ICON_NAMES)

export const permissionLevelValidator = v.union(
  v.literal(PERMISSION_LEVEL.NONE),
  v.literal(PERMISSION_LEVEL.VIEW),
  v.literal(PERMISSION_LEVEL.EDIT),
  v.literal(PERMISSION_LEVEL.FULL_ACCESS),
)
