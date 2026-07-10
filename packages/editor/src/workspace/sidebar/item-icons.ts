import { RESOURCE_ICON_NAMES, RESOURCE_TYPES } from '../items-persistence-contract'
import type { AnyItem } from '../items'
import type { ResourceIconName, ResourceKind } from '../resource-contract'

import { DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE } from '../items/appearance'
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
} satisfies Record<ResourceIconName, LucideIcon>

export const getIconByName = (iconName?: string): LucideIcon => {
  if (!iconName) return FileText
  return iconNameMap[iconName as ResourceIconName] ?? FileText
}

export const getAvailableIconNames = (): Array<ResourceIconName> => {
  return [...RESOURCE_ICON_NAMES]
}

// Default icons for each sidebar item type
export const DEFAULT_SIDEBAR_ITEM_ICONS: Record<ResourceKind, LucideIcon> = {
  [RESOURCE_TYPES.notes]: iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[RESOURCE_TYPES.notes]],
  [RESOURCE_TYPES.folders]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[RESOURCE_TYPES.folders]],
  [RESOURCE_TYPES.gameMaps]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[RESOURCE_TYPES.gameMaps]],
  [RESOURCE_TYPES.files]: iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[RESOURCE_TYPES.files]],
  [RESOURCE_TYPES.canvases]:
    iconNameMap[DEFAULT_SIDEBAR_ITEM_ICON_NAME_BY_TYPE[RESOURCE_TYPES.canvases]],
}

export const getSidebarItemIcon = (item: AnyItem | undefined): LucideIcon => {
  if (!item) return HelpCircle
  if (item.iconName) {
    return getIconByName(item.iconName)
  }

  return DEFAULT_SIDEBAR_ITEM_ICONS[item.type]
}
