import type {
  AnySidebarItem,
  SidebarItemId,
  SidebarItemOrRootType,
  SidebarItemShareStatus,
} from 'convex/sidebarItems/types'
import type { CampaignMember, CampaignMemberRole } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'

export interface ShareState {
  shareStatus: SidebarItemShareStatus
  sharedMemberIds: Set<Id<'campaignMembers'>> // Only populated if individually_shared
  playerMembers: Array<CampaignMember>
  isLoading: boolean
}

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

  // User/permissions
  currentUserId?: string
  memberRole?: CampaignMemberRole

  // View state
  activeMapId?: string
  activeCanvasId?: string
  pinnedItemIds?: Set<SidebarItemId>

  // Session state
  hasActiveSession?: boolean

  // Pin context (for map pin menus)
  pinId?: Id<'mapPins'>
  mapId?: Id<'gameMaps'>

  // Share state (for sidebar items)
  shareState?: ShareState
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

  // Submenus - can be static array or dynamic function
  children?: Array<MenuItemDef> | ((ctx: MenuContext) => Array<MenuItemDef>)

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
