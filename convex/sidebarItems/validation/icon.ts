import { zodToConvex } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemType } from '../types/baseTypes'
import { parseOrThrowClientValidation } from '../../common/zod'

export const SIDEBAR_ITEM_ICON_NAMES = [
  'Apple',
  'Axe',
  'Beef',
  'Bird',
  'BowArrow',
  'Box',
  'Calendar',
  'Cat',
  'Cherry',
  'Dog',
  'File',
  'FileText',
  'Flame',
  'Folder',
  'Gem',
  'Grid2x2Plus',
  'Heart',
  'Locate',
  'MapPin',
  'MessageCircleWarning',
  'Moon',
  'Mountain',
  'Music',
  'Notebook',
  'Share2',
  'Shield',
  'Sparkles',
  'Squirrel',
  'Star',
  'Sun',
  'Sword',
  'User',
] as const

export type SidebarItemIconName = (typeof SIDEBAR_ITEM_ICON_NAMES)[number]

const SIDEBAR_ITEM_ICON_NAME_SET = new Set<string>(SIDEBAR_ITEM_ICON_NAMES)

export const sidebarItemIconNameSchema = z
  .string()
  .refine((value): value is SidebarItemIconName => SIDEBAR_ITEM_ICON_NAME_SET.has(value), {
    message: 'Icon is not supported',
  })

export const sidebarItemIconNameValidator = zodToConvex(sidebarItemIconNameSchema)

export const DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE: Record<SidebarItemType, SidebarItemIconName> =
  {
    [SIDEBAR_ITEM_TYPES.notes]: 'FileText',
    [SIDEBAR_ITEM_TYPES.folders]: 'Folder',
    [SIDEBAR_ITEM_TYPES.gameMaps]: 'MapPin',
    [SIDEBAR_ITEM_TYPES.files]: 'File',
    [SIDEBAR_ITEM_TYPES.canvases]: 'Grid2x2Plus',
  }

export function getDefaultSidebarItemIconName(type: SidebarItemType): SidebarItemIconName {
  return DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[type]
}

export function validateSidebarItemIconName(iconName: string): string | null {
  const result = sidebarItemIconNameSchema.safeParse(iconName)
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid icon')
}

export function parseSidebarItemIconName(iconName: string): SidebarItemIconName | null {
  const result = sidebarItemIconNameSchema.safeParse(iconName)
  return result.success ? result.data : null
}

export function assertSidebarItemIconName(iconName: string): SidebarItemIconName {
  const result = sidebarItemIconNameSchema.safeParse(iconName)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid icon')
  }
  return result.data
}

export function requireSidebarItemIconName(iconName: string): SidebarItemIconName {
  return parseOrThrowClientValidation(sidebarItemIconNameSchema, iconName, 'Invalid icon')
}

export function requireOptionalSidebarItemIconName(
  iconName: string | null | undefined,
): SidebarItemIconName | null | undefined {
  if (iconName === undefined || iconName === null) {
    return iconName
  }

  return requireSidebarItemIconName(iconName)
}

export function coerceSidebarItemIconNameForInput(iconName: string): SidebarItemIconName
export function coerceSidebarItemIconNameForInput(iconName: null): null
export function coerceSidebarItemIconNameForInput(iconName: undefined): undefined
export function coerceSidebarItemIconNameForInput(
  iconName: string | null | undefined,
): SidebarItemIconName | null | undefined {
  if (iconName === undefined || iconName === null) {
    return iconName
  }

  return assertSidebarItemIconName(iconName)
}
