import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { LucideIcon } from 'lucide-react'
import {
  Apple,
  Axe,
  Beef,
  Bird,
  BowArrow,
  Box,
  Calendar,
  Cat,
  Cherry,
  Dog,
  File,
  FileText,
  Flame,
  Folder,
  Gem,
  Heart,
  Locate,
  MapPin,
  MessageCircleWarning,
  Moon,
  Mountain,
  Music,
  Notebook,
  Share2,
  Shield,
  Sparkles,
  Squirrel,
  Star,
  Sun,
  Sword,
  User,
} from '~/lib/icons'

// Map of icon names to LucideIcon components
const iconNameMap: Record<string, LucideIcon> = {
  User,
  MapPin,
  Calendar,
  Share2,
  Sword,
  Shield,
  Notebook,
  Apple,
  Axe,
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
  File,
  FileText,
  Folder,
}

export const getIconByName = (iconName?: string): LucideIcon => {
  if (!iconName) return FileText
  return iconNameMap[iconName] ?? FileText
}

export const getAvailableIconNames = (): Array<string> => {
  return Object.keys(iconNameMap)
}

// Default icons for each sidebar item type
const DEFAULT_SIDEBAR_ITEM_ICONS: Record<string, LucideIcon> = {
  [SIDEBAR_ITEM_TYPES.folders]: Folder,
  [SIDEBAR_ITEM_TYPES.notes]: FileText,
  [SIDEBAR_ITEM_TYPES.gameMaps]: MapPin,
  [SIDEBAR_ITEM_TYPES.files]: File,
}

/**
 * Gets the appropriate icon for any sidebar item.
 * Uses custom iconName if set, otherwise falls back to default for the item type.
 */
export const getSidebarItemIcon = (item: AnySidebarItem): LucideIcon => {
  // If item has a custom icon, use it
  if (item.iconName) {
    return getIconByName(item.iconName)
  }

  // Otherwise use the default for the item type
  return DEFAULT_SIDEBAR_ITEM_ICONS[item.type] ?? FileText
}
