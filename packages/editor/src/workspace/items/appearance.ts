import type { ResourceColor, ResourceIconName, ResourceKind } from '../resource-contract'
import { RESOURCE_ICON_NAMES } from '../items-persistence-contract'

export const DEFAULT_SIDEBAR_ITEM_COLOR = '#9a6dd7' as const

const SIDEBAR_ITEM_HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function validateSidebarItemColor(color: string): string | null {
  return SIDEBAR_ITEM_HEX_COLOR_REGEX.test(color) ? null : 'Color must be a 6- or 8-digit hex value'
}

function parseSidebarItemColor(color: string): ResourceColor | null {
  return validateSidebarItemColor(color) === null ? (color.toLowerCase() as ResourceColor) : null
}

function requireSidebarItemColor(color: string): ResourceColor {
  const parsed = parseSidebarItemColor(color)
  if (!parsed) {
    throw new Error(validateSidebarItemColor(color) ?? 'Invalid color')
  }
  return parsed
}

export function coerceSidebarItemColorForInput(color: string): ResourceColor
export function coerceSidebarItemColorForInput(color: null): null
export function coerceSidebarItemColorForInput(color: undefined): undefined
export function coerceSidebarItemColorForInput(
  color: string | null | undefined,
): ResourceColor | null | undefined {
  if (color === undefined || color === null) {
    return color
  }

  return requireSidebarItemColor(color)
}

export function normalizeSidebarItemColorOrDefault(
  color: string | null | undefined,
  defaultColor: string = DEFAULT_SIDEBAR_ITEM_COLOR,
): ResourceColor {
  return parseSidebarItemColor(color ?? '') ?? requireSidebarItemColor(defaultColor)
}

function validateSidebarItemIconName(iconName: string): string | null {
  return RESOURCE_ICON_NAMES.includes(iconName as ResourceIconName) ? null : 'Icon is not supported'
}

function requireSidebarItemIconName(iconName: string): ResourceIconName {
  const error = validateSidebarItemIconName(iconName)
  if (error) {
    throw new Error(error)
  }
  return iconName as ResourceIconName
}

export function coerceSidebarItemIconNameForInput(iconName: string): ResourceIconName
export function coerceSidebarItemIconNameForInput(iconName: null): null
export function coerceSidebarItemIconNameForInput(iconName: undefined): undefined
export function coerceSidebarItemIconNameForInput(
  iconName: string | null | undefined,
): ResourceIconName | null | undefined {
  if (iconName === undefined || iconName === null) {
    return iconName
  }

  return requireSidebarItemIconName(iconName)
}

export const DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE = {
  note: 'FileText',
  folder: 'Folder',
  gameMap: 'MapPin',
  file: 'File',
  canvas: 'Grid2x2Plus',
} as const satisfies Record<ResourceKind, ResourceIconName>
