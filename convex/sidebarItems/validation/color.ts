import type { BrandedString } from '../../common/slug'

export type SidebarItemColor = BrandedString<'SidebarItemColor'>

export const DEFAULT_SIDEBAR_ITEM_COLOR = '#9a6dd7' as const

const SIDEBAR_ITEM_HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export function validateSidebarItemColor(color: string): string | null {
  return SIDEBAR_ITEM_HEX_COLOR_REGEX.test(color) ? null : 'Color must be a 6- or 8-digit hex value'
}

export function parseSidebarItemColor(color: string): SidebarItemColor | null {
  return validateSidebarItemColor(color) === null ? (color.toLowerCase() as SidebarItemColor) : null
}

export function assertSidebarItemColor(color: string): SidebarItemColor {
  const parsed = parseSidebarItemColor(color)
  if (!parsed) {
    throw new Error(validateSidebarItemColor(color) ?? 'Invalid color')
  }
  return parsed
}

export function requireSidebarItemColor(color: string): SidebarItemColor {
  return assertSidebarItemColor(color)
}

export function requireOptionalSidebarItemColor(
  color: string | null | undefined,
): SidebarItemColor | null | undefined {
  if (color === undefined || color === null) {
    return color
  }

  return requireSidebarItemColor(color)
}

export function coerceSidebarItemColorForInput(color: string): SidebarItemColor
export function coerceSidebarItemColorForInput(color: null): null
export function coerceSidebarItemColorForInput(color: undefined): undefined
export function coerceSidebarItemColorForInput(
  color: string | null | undefined,
): SidebarItemColor | null | undefined {
  if (color === undefined || color === null) {
    return color
  }

  return assertSidebarItemColor(color)
}

export function isValidSidebarItemColor(color: string | null | undefined): boolean {
  return typeof color === 'string' && parseSidebarItemColor(color) !== null
}

export function normalizeSidebarItemColorOrDefault(
  color: string | null | undefined,
  defaultColor: string = DEFAULT_SIDEBAR_ITEM_COLOR,
): SidebarItemColor {
  return parseSidebarItemColor(color ?? '') ?? assertSidebarItemColor(defaultColor)
}
