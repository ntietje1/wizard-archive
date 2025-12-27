import { groupConfig } from './menu-registry'
import type { BuiltMenu, MenuContext, MenuGroup, MenuItemDef } from './types'

function processMenuItem(
  item: MenuItemDef,
  ctx: MenuContext,
): MenuItemDef | null {
  const filteredChildren = item.children
    ? item.children
        .filter((child) => child.shouldShow(ctx))
        .map((child) => processMenuItem(child, ctx))
        .filter((child): child is MenuItemDef => child !== null)
        .sort((a, b) => a.priority - b.priority) // Sort children by priority
    : undefined

  if (item.children && (!filteredChildren || filteredChildren.length === 0)) {
    return null
  }

  return {
    ...item,
    children: filteredChildren,
  }
}

export function buildMenu(items: Array<MenuItemDef>, ctx: MenuContext): BuiltMenu {
  // filter to visible items and process submenus
  const visible = items
    .filter((item) => item.shouldShow(ctx))
    .map((item) => processMenuItem(item, ctx))
    .filter((item): item is MenuItemDef => item !== null)

  if (visible.length === 0) {
    return { groups: [], flatItems: [], isEmpty: true }
  }

  // group items
  const groupMap = visible.reduce((map, item) => {
    const group = item.group
    if (!map.has(group)) {
      map.set(group, [])
    }
    map.get(group)!.push(item)
    return map
  }, new Map<string, Array<MenuItemDef>>())

  // sort items within each group
  for (const groupItems of groupMap.values()) {
    groupItems.sort((a, b) => a.priority - b.priority)
  }

  // sort groups
  const sortedGroupIds = Array.from(groupMap.keys()).sort((a, b) => {
    const aPriority = groupConfig[a as keyof typeof groupConfig].priority
    const bPriority = groupConfig[b as keyof typeof groupConfig].priority
    return aPriority - bPriority
  })

  // combine
  const groups: Array<MenuGroup> = sortedGroupIds.map((id) => ({
    id,
    items: groupMap.get(id)!,
  }))

  return {
    groups,
    flatItems: visible,
    isEmpty: false,
  }
}
