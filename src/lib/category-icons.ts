import { SYSTEM_DEFAULT_CATEGORIES } from 'convex/tags/types'
import {
  Calendar,
  User,
  MapPin,
  Share2,
  Notebook,
  Shield,
  Axe,
  TagIcon,
  Sword,
  Apple,
  Beef,
  Bird,
  BowArrow,
  Box,
  Cat,
  Cherry,
  Dog,
  Flame,
  Gem,
  Heart,
  Locate,
  MessageCircleWarning,
  Moon,
  Mountain,
  Music,
  Sparkles,
  Squirrel,
  Sun,
  Star,
  Folder,
  FileText,
} from '~/lib/icons'
import type { LucideIcon } from 'lucide-react'
import {
  SIDEBAR_ITEM_TYPES,
  type AnySidebarItem,
} from 'convex/sidebarItems/types'

const categoryIconsMap: Record<string, LucideIcon> = {
  [SYSTEM_DEFAULT_CATEGORIES.Character.iconName]: User,
  [SYSTEM_DEFAULT_CATEGORIES.Location.iconName]: MapPin,
  [SYSTEM_DEFAULT_CATEGORIES.Session.iconName]: Calendar,
  [SYSTEM_DEFAULT_CATEGORIES.Shared.iconName]: Share2,
  ['TagIcon']: TagIcon,
  ['Sword']: Sword,
  ['Shield']: Shield,
  ['Notebook']: Notebook,
  ['Apple']: Apple,
  ['Axe']: Axe,
  ['Beef']: Beef,
  ['Bird']: Bird,
  ['BowArrow']: BowArrow,
  ['Box']: Box,
  ['Cat']: Cat,
  ['Cherry']: Cherry,
  ['Dog']: Dog,
  ['Flame']: Flame,
  ['Gem']: Gem,
  ['Heart']: Heart,
  ['Locate']: Locate,
  ['MessageCircleWarning']: MessageCircleWarning,
  ['Moon']: Moon,
  ['Mountain']: Mountain,
  ['Music']: Music,
  ['Sparkles']: Sparkles,
  ['Squirrel']: Squirrel,
  ['Sun']: Sun,
  ['Star']: Star,
}

export const getCategoryIcon = (categoryName?: string): LucideIcon => {
  return (categoryName && categoryIconsMap[categoryName]) || TagIcon
}

export const getNonDefaultCategoryIcons = () => {
  return Object.keys(categoryIconsMap).filter(
    (iconName) =>
      !Object.values(SYSTEM_DEFAULT_CATEGORIES)
        .map((c) => c.iconName)
        .includes(iconName),
  )
}

// Default icons for each sidebar item type
const DEFAULT_SIDEBAR_ITEM_ICONS: Record<string, LucideIcon> = {
  [SIDEBAR_ITEM_TYPES.folders]: Folder,
  [SIDEBAR_ITEM_TYPES.notes]: FileText,
  [SIDEBAR_ITEM_TYPES.gameMaps]: MapPin,
  [SIDEBAR_ITEM_TYPES.tags]: TagIcon,
}

/**
 * Gets the appropriate icon for any sidebar item.
 * Uses category icons for categories and tags, default icons for other types.
 */
export const getSidebarItemIcon = (item: AnySidebarItem): LucideIcon => {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.tagCategories:
      return getCategoryIcon(item.iconName)
    case SIDEBAR_ITEM_TYPES.tags:
      return getCategoryIcon(item.category?.iconName) || TagIcon
    case SIDEBAR_ITEM_TYPES.folders:
    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return DEFAULT_SIDEBAR_ITEM_ICONS[item.type] || FileText
    default:
      return FileText
  }
}
