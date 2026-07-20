import {
  Apple,
  Axe,
  Beef,
  Bird,
  BookOpen,
  BowArrow,
  Box,
  Calendar,
  Cat,
  Cherry,
  Compass,
  Dog,
  File,
  FileText,
  Flame,
  Folder,
  Gem,
  Grid2x2Plus,
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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { resourceKindIcon } from './resource-presentation'

const RESOURCE_ICON_ENTRIES = [
  ['Apple', Apple],
  ['Axe', Axe],
  ['Beef', Beef],
  ['Bird', Bird],
  ['BookOpen', BookOpen],
  ['BowArrow', BowArrow],
  ['Box', Box],
  ['Calendar', Calendar],
  ['Cat', Cat],
  ['Cherry', Cherry],
  ['Compass', Compass],
  ['Dog', Dog],
  ['File', File],
  ['FileText', FileText],
  ['Flame', Flame],
  ['Folder', Folder],
  ['Gem', Gem],
  ['Grid2x2Plus', Grid2x2Plus],
  ['Heart', Heart],
  ['Locate', Locate],
  ['MapPin', MapPin],
  ['MessageCircleWarning', MessageCircleWarning],
  ['Moon', Moon],
  ['Mountain', Mountain],
  ['Music', Music],
  ['Notebook', Notebook],
  ['Share2', Share2],
  ['Shield', Shield],
  ['Sparkles', Sparkles],
  ['Squirrel', Squirrel],
  ['Star', Star],
  ['Sun', Sun],
  ['Sword', Sword],
  ['User', User],
] as const satisfies ReadonlyArray<readonly [string, LucideIcon]>

type ResourceIconName = (typeof RESOURCE_ICON_ENTRIES)[number][0]

export const RESOURCE_ICONS = Object.fromEntries(RESOURCE_ICON_ENTRIES) as Record<
  ResourceIconName,
  LucideIcon
>

export function resourceDisplayIcon(resource: AuthorizedResourceSummary): LucideIcon {
  if (resource.icon && resource.icon in RESOURCE_ICONS) {
    return RESOURCE_ICONS[resource.icon as keyof typeof RESOURCE_ICONS]
  }
  return resourceKindIcon(resource.kind)
}
