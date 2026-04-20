import type {
  BuiltContextMenu,
  ContextMenuCommand,
  ContextMenuContributor,
  ContextMenuGroupConfig,
  ContextMenuItemSpec,
  ContextMenuScope,
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

  const command = item.commandId ? commands[item.commandId] : undefined
  if (item.commandId && !command) {
    throw new Error(`Missing context-menu command "${item.commandId}"`)
  }

  const childrenSource =
    typeof item.children === 'function' ? item.children(context, services, payload) : item.children
  const children = childrenSource
    ?.map((child) => resolveContextMenuItem(child, context, services, commands))
    .filter((child): child is ResolvedContextMenuItem => child !== null)
    .sort((a, b) => a.priority - b.priority)

  const label = item.label ?? command?.label
  if (!label) {
    throw new Error(`Missing context-menu label for item "${item.id}"`)
  }

  return {
    id: item.id,
    commandId: item.commandId,
    label: resolveValue(label, context, services, payload),
    icon: item.icon ?? command?.icon,
    shortcut: item.shortcut
      ? resolveValue(item.shortcut, context, services, payload)
      : command?.shortcut
        ? resolveValue(command.shortcut, context, services, payload)
        : undefined,
    disabled: item.isDisabled
      ? item.isDisabled(context, services, payload)
      : command?.isEnabled
        ? !command.isEnabled(context, services, payload)
        : false,
    checked: item.isChecked
      ? item.isChecked(context, services, payload)
      : command?.isChecked
        ? command.isChecked(context, services, payload)
        : false,
    group: item.group,
    priority: item.priority,
    scope: item.scope ?? 'base',
    variant: item.variant,
    className: item.className,
    children: children && children.length > 0 ? children : undefined,
    onSelect: () => {
      if (item.onSelect) {
        return item.onSelect(context, services, payload)
      }
      if (!command) return
      return command.run(context, services, payload)
    },
  }
}

function suppressDuplicateSelectionItems(items: Array<ResolvedContextMenuItem>) {
  const targetCommandIds = new Set(
    items
      .filter((item) => item.scope === 'target')
      .map((item) => item.commandId)
      .filter(Boolean),
  )

  return items.filter(
    (item) =>
      !(item.scope === 'selection' && item.commandId && targetCommandIds.has(item.commandId)),
  )
}

export function buildMenu<TContext extends { surface: ContextMenuSurfaceId }, TServices>({
  context,
  services,
  contributors,
  commands,
  groupConfig,
}: BuildContextMenuOptions<TContext, TServices>): BuiltContextMenu {
  const resolvedItems = suppressDuplicateSelectionItems(
    contributors
      .filter((contributor) => contributor.surfaces.includes(context.surface))
      .filter((contributor) => contributor.applies?.(context, services) ?? true)
      .flatMap((contributor) => contributor.getItems(context, services))
      .map((item) => resolveContextMenuItem(item, context, services, commands))
      .filter((item): item is ResolvedContextMenuItem => item !== null),
  )

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
    flatItems: resolvedItems,
    isEmpty: false,
  }
}

export type { ContextMenuScope }
