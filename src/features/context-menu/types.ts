import type React from 'react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { BlockNoteId } from 'shared/editor-blocks/types'
import type { CampaignMemberRole, CampaignMemberSummary } from 'shared/campaigns/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteWithContent } from 'shared/notes/types'
import type { PermissionLevel } from 'shared/permissions/types'
import type { EditorMode } from 'shared/editor/types'
import type { Id } from 'convex/_generated/dataModel'
import type { GameMapWithContent, MapPinWithItem } from 'shared/game-maps/types'
import type { LucideIcon } from 'lucide-react'
import type { VIEW_CONTEXT } from './constants'

export type ViewContext = (typeof VIEW_CONTEXT)[keyof typeof VIEW_CONTEXT]

export type ContextMenuSurfaceId = ViewContext | 'canvas'

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
  content?: ContextMenuResolver<React.ReactNode, TContext, TServices, TPayload>
  icon?: LucideIcon
  shortcut?: ContextMenuResolver<string | undefined, TContext, TServices, TPayload>
  applies?: ContextMenuPredicate<TContext, TServices, TPayload>
  isEnabled?: ContextMenuPredicate<TContext, TServices, TPayload>
  isChecked?: ContextMenuPredicate<TContext, TServices, TPayload>
  onSelect?: (
    context: TContext,
    services: TServices,
    payload: TPayload | undefined,
  ) => void | Promise<void>
  group: string
  priority: number
  children?:
    | Array<ContextMenuItemSpec<TContext, TServices, unknown>>
    | ((
        context: TContext,
        services: TServices,
        payload: TPayload | undefined,
      ) => Array<ContextMenuItemSpec<TContext, TServices, unknown>>)
  submenuContent?: ContextMenuResolver<React.ReactNode, TContext, TServices, TPayload>
  variant?: 'default' | 'danger' | 'share'
  className?: string
  closeOnSelect?: boolean
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
  content?: React.ReactNode
  icon?: LucideIcon
  shortcut?: string
  disabled: boolean
  checked: boolean
  group: string
  priority: number
  variant?: 'default' | 'danger' | 'share'
  className?: string
  closeOnSelect?: boolean
  children?: Array<ResolvedContextMenuItem>
  submenuContent?: React.ReactNode
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
  /** Item under the context-click target, when the menu opened on a concrete item. */
  item?: AnySidebarItem
  /**
   * Main selected item for commands. When selectedItems is non-empty, this should be the first
   * selected item unless explicitly set to another item inside selectedItems.
   */
  primaryItem?: AnySidebarItem
  /**
   * Ordered full item objects for the active selection; undefined means no selection context,
   * [] means the selection surface is active but empty. primaryItem must not point outside this
   * array when the array is non-empty.
   */
  selectedItems?: Array<AnySidebarItem>
  currentUserId?: string
  memberRole?: CampaignMemberRole
  permissionLevel?: PermissionLevel
  activeMap?: GameMapWithContent
  activePin?: MapPinWithItem
  isItemTrashed?: boolean
  isTrashView?: boolean
  hasActiveSession?: boolean
  note?: NoteWithContent
  editor?: CustomBlockNoteEditor
  position?: { x: number; y: number }
  blockNoteId?: BlockNoteId
  isEditorTextContext?: boolean
  valueInlineId?: string
  valueInlineInstanceId?: string
  valueInlineEditable?: boolean
  openValueInline?: (valueId: string, instanceId: string | undefined) => void
}

export interface EditorModeMenuService {
  editorMode: EditorMode
  canEdit: boolean
  setEditorMode: (editorMode: EditorMode) => void
}

export interface ViewAsPlayerMenuService {
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  playerMembers: Array<CampaignMemberSummary>
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

export type MenuContext = EditorMenuContext

export type Predicate = (context: EditorMenuContext) => boolean
