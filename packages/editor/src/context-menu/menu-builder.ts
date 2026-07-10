import type {
  BuiltContextMenu,
  ContextMenuCommand,
  ContextMenuContributor,
  ContextMenuGroupConfig,
  ContextMenuItemSpec,
  ContextMenuSurfaceId,
  ResolvedContextMenuItem,
} from './types'

type CommandMap<TContext, TServices> = Readonly<
  Record<string, ContextMenuCommand<TContext, TServices, any>>
>

interface BuildContextMenuOptions<TContext extends { surface: ContextMenuSurfaceId }, TServices> {
  context: TContext
  services: TServices
  contributors: ReadonlyArray<ContextMenuContributor<TContext, TServices>>
  commands: CommandMap<TContext, TServices>
  groupConfig: ContextMenuGroupConfig
}

function resolveValue<TValue, TContext, TServices, TPayload>(
  value:
    | TValue
    | ((context: TContext, services: TServices, payload: TPayload | undefined) => TValue),
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
): TValue {
  return typeof value === 'function'
    ? (value as (context: TContext, services: TServices, payload: TPayload | undefined) => TValue)(
        context,
        services,
        payload,
      )
    : value
}

function resolveShortcut<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  command: ContextMenuCommand<TContext, TServices, TPayload> | undefined,
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
) {
  const shortcut = item.shortcut ?? command?.shortcut
  return shortcut ? resolveValue(shortcut, context, services, payload) : undefined
}

function resolveDisabled<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  command: ContextMenuCommand<TContext, TServices, TPayload> | undefined,
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
) {
  const isEnabled = item.isEnabled ?? command?.isEnabled
  return isEnabled ? !isEnabled(context, services, payload) : false
}

function resolveChecked<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  command: ContextMenuCommand<TContext, TServices, TPayload> | undefined,
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
) {
  const isChecked = item.isChecked ?? command?.isChecked
  return isChecked ? isChecked(context, services, payload) : false
}

function withSubmenuEllipsis(label: string, hasSubmenu: boolean): string {
  if (!hasSubmenu || label.endsWith('...')) return label
  return `${label}...`
}

function resolveChildren<TContext extends { surface: ContextMenuSurfaceId }, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  context: TContext,
  services: TServices,
  commands: CommandMap<TContext, TServices>,
  payload: TPayload | undefined,
): Array<ResolvedContextMenuItem> | undefined {
  const childrenSource =
    typeof item.children === 'function' ? item.children(context, services, payload) : item.children
  if (!childrenSource) return undefined

  const children = childrenSource
    .map((child) => resolveContextMenuItem(child, context, services, commands))
    .filter((child): child is ResolvedContextMenuItem => child !== null)
    .sort((a, b) => a.priority - b.priority)

  return children.length > 0 ? children : undefined
}

function resolveSubmenuContent<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
) {
  return item.submenuContent
    ? resolveValue(item.submenuContent, context, services, payload)
    : undefined
}

function resolveLabel<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  command: ContextMenuCommand<TContext, TServices, TPayload> | undefined,
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
  hasSubmenu: boolean,
) {
  const labelSource = item.label ?? command?.label
  if (!labelSource) {
    throw new Error(`Missing context-menu label for item "${item.id}"`)
  }

  return withSubmenuEllipsis(resolveValue(labelSource, context, services, payload), hasSubmenu)
}

function createOnSelect<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  command: ContextMenuCommand<TContext, TServices, TPayload> | undefined,
  context: TContext,
  services: TServices,
  payload: TPayload | undefined,
) {
  return async () => {
    if (item.onSelect) {
      await item.onSelect(context, services, payload)
      return
    }
    if (!command) return
    await command.run(context, services, payload)
  }
}

function resolveCommand<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  commands: CommandMap<TContext, TServices>,
) {
  if (item.commandId === undefined) return undefined

  if (item.commandId.trim().length === 0) {
    throw new Error(`Invalid context-menu command id for item "${item.id}"`)
  }

  const command = commands[item.commandId]
  if (!command) {
    throw new Error(`Missing context-menu command "${item.commandId}"`)
  }

  return command
}

function validateSelectableItem<TContext, TServices, TPayload>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  command: ContextMenuCommand<TContext, TServices, TPayload> | undefined,
  hasSubmenu: boolean,
) {
  if (hasSubmenu || item.onSelect || command) return

  throw new Error(`Missing context-menu action for leaf item "${item.id}"`)
}

function resolveContextMenuItem<
  TContext extends { surface: ContextMenuSurfaceId },
  TServices,
  TPayload,
>(
  item: ContextMenuItemSpec<TContext, TServices, TPayload>,
  context: TContext,
  services: TServices,
  commands: CommandMap<TContext, TServices>,
): ResolvedContextMenuItem | null {
  const payload = item.payload
  if (item.applies && !item.applies(context, services, payload)) {
    return null
  }

  const command = resolveCommand(item, commands)
  const children = resolveChildren(item, context, services, commands, payload)
  const submenuContent = resolveSubmenuContent(item, context, services, payload)
  const hasSubmenu = children !== undefined || submenuContent !== undefined
  validateSelectableItem(item, command, hasSubmenu)

  return {
    id: item.id,
    commandId: item.commandId,
    label: resolveLabel(item, command, context, services, payload, hasSubmenu),
    content: item.content ? resolveValue(item.content, context, services, payload) : undefined,
    icon: item.icon ?? command?.icon,
    shortcut: resolveShortcut(item, command, context, services, payload),
    disabled: resolveDisabled(item, command, context, services, payload),
    checked: resolveChecked(item, command, context, services, payload),
    group: item.group,
    priority: item.priority ?? 0,
    variant: item.variant,
    className: item.className,
    closeOnSelect: item.closeOnSelect ?? true,
    children,
    submenuContent,
    onSelect: createOnSelect(item, command, context, services, payload),
  }
}

export function buildMenu<TContext extends { surface: ContextMenuSurfaceId }, TServices>({
  context,
  services,
  contributors,
  commands,
  groupConfig,
}: BuildContextMenuOptions<TContext, TServices>): BuiltContextMenu {
  const resolvedItems = contributors
    .filter((contributor) => contributor.surfaces.includes(context.surface))
    .filter((contributor) => contributor.applies?.(context, services) ?? true)
    .flatMap((contributor) => contributor.getItems(context, services))
    .map((item) => resolveContextMenuItem(item, context, services, commands))
    .filter((item): item is ResolvedContextMenuItem => item !== null)

  if (resolvedItems.length === 0) {
    return { groups: [], flatItems: [], isEmpty: true }
  }

  const groupMap = new Map<string, Array<ResolvedContextMenuItem>>()
  for (const item of resolvedItems) {
    const items = groupMap.get(item.group)
    if (items) {
      items.push(item)
      continue
    }
    groupMap.set(item.group, [item])
  }

  for (const items of groupMap.values()) {
    items.sort((a, b) => a.priority - b.priority)
  }

  const groups = Array.from(groupMap.entries())
    .sort(([a], [b]) => {
      const aPriority = groupConfig[a]?.priority ?? Number.MAX_SAFE_INTEGER
      const bPriority = groupConfig[b]?.priority ?? Number.MAX_SAFE_INTEGER
      return aPriority - bPriority
    })
    .map(([id, items]) => ({ id, items }))

  return {
    groups,
    flatItems: groups.flatMap((group) => group.items),
    isEmpty: false,
  }
}
