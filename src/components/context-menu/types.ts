import type {
  AnySidebarItem,
  SidebarItemId,
  SidebarItemOrRootType,
} from 'convex/sidebarItems/types'
import type { TagCategory } from 'convex/tags/types'
import type { CampaignMemberRole } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'

export type ViewContext =
  | 'sidebar'
  | 'topbar'
  | 'folder-view'
  | 'map-view'
  | 'canvas-view'
  | 'search-results'
  | 'recent-items'
  | 'favorites'

export interface MenuContext {
  // Core data
  item: AnySidebarItem | undefined
  viewContext: ViewContext
  parentType: SidebarItemOrRootType

  // Category context
  category?: TagCategory

  // User/permissions
  currentUserId?: string
  memberRole?: CampaignMemberRole

  // View state
  activeMapId?: string
  activeCanvasId?: string
  pinnedItemIds?: Set<SidebarItemId>

  // Pin context (for map pin menus)
  pinId?: Id<'mapPins'>
  mapId?: Id<'gameMaps'>
}

export type Predicate = (ctx: MenuContext) => boolean

export interface MenuItemDef {
  id: string
  label: string | ((ctx: MenuContext) => string)
  icon?: LucideIcon
  shortcut?: string

  // Visibility & state
  shouldShow: Predicate
  isDisabled?: Predicate
  isChecked?: Predicate // For toggle items

  // Action
  action: (ctx: MenuContext) => void | Promise<void>

  // Organization
  group: string
  priority: number // Lower = higher in menu

  // Submenus
  children?: Array<MenuItemDef>

  // Styling
  variant?: 'default' | 'danger' | 'success'
  className?: string
}

export interface MenuGroup {
  id: string
  items: Array<MenuItemDef>
}

export interface BuiltMenu {
  groups: Array<MenuGroup>
  flatItems: Array<MenuItemDef>
  isEmpty: boolean
}
