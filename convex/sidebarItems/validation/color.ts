import { zodToConvex } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import type { BrandedString } from '../../common/slug'
import { parseOrThrowClientValidation } from '../../common/zod'

export type SidebarItemColor = BrandedString<'SidebarItemColor'>

export const DEFAULT_SIDEBAR_ITEM_COLOR = '#14b8a6' as const

const SIDEBAR_ITEM_HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export const sidebarItemColorValueSchema = z
  .string()
  .regex(SIDEBAR_ITEM_HEX_COLOR_REGEX, 'Color must be a 6- or 8-digit hex value')

export const sidebarItemColorSchema = sidebarItemColorValueSchema.transform(
  (value) => value.toLowerCase() as SidebarItemColor,
)

export const sidebarItemColorValidator = zodToConvex(sidebarItemColorValueSchema)

export function validateSidebarItemColor(color: string): string | null {
  const result = sidebarItemColorValueSchema.safeParse(color)
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid color')
}

export function parseSidebarItemColor(color: string): SidebarItemColor | null {
  const result = sidebarItemColorSchema.safeParse(color)
  return result.success ? result.data : null
}

export function assertSidebarItemColor(color: string): SidebarItemColor {
  const parsed = parseSidebarItemColor(color)
  if (!parsed) {
    throw new Error(validateSidebarItemColor(color) ?? 'Invalid color')
  }
  return parsed
}

export function requireSidebarItemColor(color: string): SidebarItemColor {
  return parseOrThrowClientValidation(sidebarItemColorSchema, color, 'Invalid color')
}

export function requireOptionalSidebarItemColor(
  color: string | null | undefined,
): SidebarItemColor | null | undefined {
  if (color === undefined || color === null) {
    return color
  }

  return requireSidebarItemColor(color)
}

export function isValidSidebarItemColor(color: string | null | undefined): boolean {
  return typeof color === 'string' && parseSidebarItemColor(color) !== null
}

export function normalizeSidebarItemColorOrDefault(
  color: string | null | undefined,
  defaultColor: string = DEFAULT_SIDEBAR_ITEM_COLOR,
): string {
  return parseSidebarItemColor(color ?? '') ?? assertSidebarItemColor(defaultColor)
}
