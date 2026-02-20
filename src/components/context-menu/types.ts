import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { CampaignMemberRole } from 'convex/campaigns/types'
import type { LucideIcon } from '~/lib/icons'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import type { PermissionLevel } from 'convex/shares/types'

export type ViewContext =
  | 'sidebar'
  | 'topbar'
  | 'note-view'
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

  // User/permissions
  currentUserId?: string
  memberRole?: CampaignMemberRole
  permissionLevel?: PermissionLevel

  // View state
  activeMap?: GameMapWithContent
  activePin?: MapPinWithItem

  // Session state
  hasActiveSession?: boolean

  // BlockNote editor context (for editor-related menus)
  editor?: CustomBlockNoteEditor
  blockId?: string
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
  variant?: 'default' | 'danger' | 'share'
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
