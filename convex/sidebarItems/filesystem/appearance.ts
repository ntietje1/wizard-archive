import {
  assertResourceColor,
  assertResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'
import type {
  ResourceColor,
  ResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'

export function requireOptionalSidebarItemColor(
  color: string | null | undefined,
): ResourceColor | null | undefined {
  if (color === undefined || color === null) {
    return color
  }

  return assertResourceColor(color)
}

export function requireOptionalSidebarItemIconName(
  iconName: string | null | undefined,
): ResourceIconName | null | undefined {
  if (iconName === undefined || iconName === null) {
    return iconName
  }

  return assertResourceIconName(iconName)
}
