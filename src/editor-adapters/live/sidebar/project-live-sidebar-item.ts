import type { WizardEditorItem, WizardEditorItemWithContent } from '@wizard-archive/editor/adapter'

type LiveSidebarItem = Record<string, unknown> & {
  pins?: Array<Record<string, unknown> & { item?: LiveSidebarItem | null }>
}

export function projectLiveSidebarItem<
  TItem extends WizardEditorItem | WizardEditorItemWithContent,
>(item: LiveSidebarItem): TItem {
  if (!item.pins) return item as TItem
  return {
    ...item,
    pins: item.pins.map((pin) => ({
      ...pin,
      item: pin.item ? projectLiveSidebarItem(pin.item) : null,
    })),
  } as TItem
}

export function projectLiveSidebarItems<
  TItem extends WizardEditorItem | WizardEditorItemWithContent,
>(items: ReadonlyArray<LiveSidebarItem>): Array<TItem> {
  return items.map((item) => projectLiveSidebarItem<TItem>(item))
}

export function mergeProjectedItemsIntoLiveRows(
  previousRows: ReadonlyArray<LiveSidebarItem & { id?: unknown }>,
  items: ReadonlyArray<WizardEditorItem>,
): Array<LiveSidebarItem> {
  const previousById = new Map(previousRows.map((row) => [String(row.id), row] as const))
  return items.map((item) => ({ ...previousById.get(String(item.id)), ...item }))
}
