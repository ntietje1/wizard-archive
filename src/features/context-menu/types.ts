import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { BlockNoteId } from 'convex/blocks/types'
import type { CampaignMemberRole } from 'convex/campaigns/types'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { PermissionLevel } from 'convex/permissions/types'
import type { GameMapWithContent, MapPinWithItem } from 'convex/gameMaps/types'
import type { LucideIcon } from 'lucide-react'
import type { VIEW_CONTEXT } from './constants'

export type ViewContext = (typeof VIEW_CONTEXT)[keyof typeof VIEW_CONTEXT]

export type ContextMenuSurfaceId = ViewContext | 'canvas'

export type ContextMenuScope = 'base' | 'selection' | 'target'

type ContextMenuResolver<TValue, TContext, TServices, TPayload = unknown> =
  | TValue
  | ((context: TContext, services: TServices, payload: TPayload | undefined) => TValue)

type ContextMenuPredicate<TContext, TServices, TPayload = unknown> = (
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
) => boolean

export interface ContextMenuCommand<TContext, TServices, TPayload = unknown> {
  id: string
  label?: ContextMenuResolver<string, TContext, TServices, TPayload>
  icon?: LucideIcon
  shortcut?: ContextMenuResolver<string | undefined, TContext, TServices, TPayload>
  isEnabled?: ContextMenuPredicate<TContext, TServices, TPayload>
  isChecked?: ContextMenuPredicate<TContext, TServices, TPayload>
  run: (
    context: TContext,
    services: TServices,
    payload: TPayload | undefined,
  ) => void | Promise<void>
}

export interface ContextMenuItemSpec<TContext, TServices, TPayload = unknown> {
  id: string
  commandId?: string
  payload?: TPayload
  label?: ContextMenuResolver<string, TContext, TServices, TPayload>
  icon?: LucideIcon
  shortcut?: ContextMenuResolver<string | undefined, TContext, TServices, TPayload>
  applies?: ContextMenuPredicate<TContext, TServices, TPayload>
  isDisabled?: ContextMenuPredicate<TContext, TServices, TPayload>
  isChecked?: ContextMenuPredicate<TContext, TServices, TPayload>
  onSelect?: (
    context: TContext,
    services: TServices,
    payload: TPayload | undefined,
  ) => void | Promise<void>
  group: string
  priority: number
  scope?: ContextMenuScope
  children?:
    | Array<ContextMenuItemSpec<TContext, TServices, unknown>>
    | ((
        context: TContext,
        services: TServices,
        payload: TPayload | undefined,
      ) => Array<ContextMenuItemSpec<TContext, TServices, unknown>>)
  variant?: 'default' | 'danger' | 'share'
  className?: string
}

export interface ContextMenuContributor<TContext, TServices> {
  id: string
  surfaces: ReadonlyArray<ContextMenuSurfaceId>
  applies?: (context: TContext, services: TServices) => boolean
  getItems: (
    context: TContext,
    services: TServices,
  ) => Array<ContextMenuItemSpec<TContext, TServices, unknown>>
}

export interface ResolvedContextMenuItem {
  id: string
  commandId?: string
  label: string
  icon?: LucideIcon
  shortcut?: string
  disabled: boolean
  checked: boolean
  group: string
  priority: number
  scope: ContextMenuScope
  variant?: 'default' | 'danger' | 'share'
  className?: string
  children?: Array<ResolvedContextMenuItem>
  onSelect: () => void | Promise<void>
}

interface ContextMenuGroup {
  id: string
  items: Array<ResolvedContextMenuItem>
}

export interface BuiltContextMenu {
  groups: Array<ContextMenuGroup>
  flatItems: Array<ResolvedContextMenuItem>
  isEmpty: boolean
}

interface ContextMenuGroupConfigEntry {
  label: string | null
  priority: number
}

export type ContextMenuGroupConfig = Record<string, ContextMenuGroupConfigEntry>

export interface EditorMenuContext {
  surface: ViewContext
  item: AnySidebarItem | undefined
  currentUserId?: string
  memberRole?: CampaignMemberRole
  permissionLevel?: PermissionLevel
  activeMap?: GameMapWithContent
  activePin?: MapPinWithItem
  isItemTrashed?: boolean
  isTrashView?: boolean
  hasActiveSession?: boolean
  editor?: CustomBlockNoteEditor
  blockNoteId?: BlockNoteId
}

export type MenuContext = EditorMenuContext

export type Predicate = (context: EditorMenuContext) => boolean
