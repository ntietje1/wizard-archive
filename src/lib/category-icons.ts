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
  Book,
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
} from '~/lib/icons'

const categoryIconsMap = {
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

export const getCategoryIcon = (categoryName: string) => {
  return categoryIconsMap[categoryName] || TagIcon
}

export const getNonDefaultCategoryIcons = () => {
  return Object.keys(categoryIconsMap).filter(
    (iconName) =>
      !Object.values(SYSTEM_DEFAULT_CATEGORIES)
        .map((c) => c.iconName)
        .includes(iconName),
  )
}
