import type React from 'react'
import type { LucideIcon } from 'lucide-react'

export type ContextMenuSurfaceId = string

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
  run: (context: TContext, services: TServices, payload?: TPayload) => void | Promise<void>
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
    | Array<ContextMenuItemSpec<TContext, TServices, TPayload>>
    | ((
        context: TContext,
        services: TServices,
        payload: TPayload | undefined,
      ) => Array<ContextMenuItemSpec<TContext, TServices, TPayload>>)
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
