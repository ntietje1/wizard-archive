import {
  DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE,
  SIDEBAR_ITEM_ICON_NAMES,
} from 'convex/sidebarItems/icon'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
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
  Grid2x2Plus,
  Heart,
  HelpCircle,
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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SidebarItemIconName } from 'convex/sidebarItems/icon'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'

// Map of icon names to LucideIcon components
const iconNameMap = {
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
  Grid2x2Plus,
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
} satisfies Record<SidebarItemIconName, LucideIcon>

export const getIconByName = (iconName?: string): LucideIcon => {
  if (!iconName) return FileText
  return iconNameMap[iconName as SidebarItemIconName] ?? FileText
}

export const getAvailableIconNames = (): Array<SidebarItemIconName> => {
  return [...SIDEBAR_ITEM_ICON_NAMES]
}

// Default icons for each sidebar item type
export const DEFAULT_SIDEBAR_ITEM_ICONS: Record<SidebarItemType, LucideIcon> = {
  [SIDEBAR_ITEM_TYPES.notes]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[SIDEBAR_ITEM_TYPES.notes]],
  [SIDEBAR_ITEM_TYPES.folders]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[SIDEBAR_ITEM_TYPES.folders]],
  [SIDEBAR_ITEM_TYPES.gameMaps]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[SIDEBAR_ITEM_TYPES.gameMaps]],
  [SIDEBAR_ITEM_TYPES.files]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[SIDEBAR_ITEM_TYPES.files]],
  [SIDEBAR_ITEM_TYPES.canvases]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[SIDEBAR_ITEM_TYPES.canvases]],
}

export const getSidebarItemIcon = (item: AnySidebarItem | undefined): LucideIcon => {
  if (!item) return HelpCircle
  if (item.iconName) {
    return getIconByName(item.iconName)
  }

  return DEFAULT_SIDEBAR_ITEM_ICONS[item.type] ?? FileText
}
