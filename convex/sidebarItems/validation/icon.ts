import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemType } from '../types/baseTypes'

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
  return SIDEBAR_ITEM_ICON_NAME_SET.has(iconName) ? null : 'Icon is not supported'
}

export function parseSidebarItemIconName(iconName: string): SidebarItemIconName | null {
  return SIDEBAR_ITEM_ICON_NAME_SET.has(iconName) ? (iconName as SidebarItemIconName) : null
}

export function assertSidebarItemIconName(iconName: string): SidebarItemIconName {
  const error = validateSidebarItemIconName(iconName)
  if (error) {
    throw new Error(error)
  }
  return iconName as SidebarItemIconName
}

export function requireSidebarItemIconName(iconName: string): SidebarItemIconName {
  return assertSidebarItemIconName(iconName)
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
