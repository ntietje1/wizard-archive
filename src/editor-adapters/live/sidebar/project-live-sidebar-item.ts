import {
  isWizardEditorFileItemType,
  isWizardEditorGameMapItemType,
} from '@wizard-archive/editor/adapter'
import type { WizardEditorItem, WizardEditorItemWithContent } from '@wizard-archive/editor/adapter'
import type { AssetId } from 'shared/common/ids'

type LiveSidebarItem = Record<string, unknown> & {
  type?: string
  previewStorageId?: string | null
  storageId?: string | null
  imageStorageId?: string | null
  layers?: Array<Record<string, unknown> & { imageStorageId?: string | null }>
  pins?: Array<Record<string, unknown> & { item?: LiveSidebarItem | null }>
}

export function projectLiveSidebarItem<
  TItem extends WizardEditorItem | WizardEditorItemWithContent,
>(item: LiveSidebarItem): TItem {
  const { imageStorageId, layers, pins, previewStorageId, storageId, ...baseFields } = item
  const base = {
    ...baseFields,
    previewAssetId: (previewStorageId ?? null) as AssetId | null,
  }

  if (isWizardEditorFileItemType(item.type)) {
    return {
      ...base,
      assetId: (storageId ?? null) as AssetId | null,
    } as TItem
  }

  if (isWizardEditorGameMapItemType(item.type)) {
    return {
      ...base,
      imageAssetId: (imageStorageId ?? null) as AssetId | null,
      ...(layers
        ? {
            layers: layers.map((layer) => {
              const { imageStorageId: layerStorageId, ...layerFields } = layer
              return {
                ...layerFields,
                imageAssetId: (layerStorageId ?? null) as AssetId | null,
              }
            }),
          }
        : {}),
      ...(pins
        ? {
            pins: pins.map((pin) => ({
              ...pin,
              item: pin.item ? projectLiveSidebarItem(pin.item) : null,
            })),
          }
        : {}),
    } as TItem
  }

  return base as TItem
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
  return items.map((item) => mergeProjectedItemIntoLiveRow(previousById.get(String(item.id)), item))
}

function mergeProjectedItemIntoLiveRow(
  previous: LiveSidebarItem | undefined,
  item: WizardEditorItem,
): LiveSidebarItem {
  const projected = { ...item } as Record<string, unknown> & { type?: string }
  const next: LiveSidebarItem = { ...previous, ...projected }

  if ('previewAssetId' in projected) {
    next.previewStorageId = projected.previewAssetId as string | null
    delete next.previewAssetId
  }
  if (isWizardEditorFileItemType(item.type)) {
    next.storageId = projected.assetId as string | null
    delete next.assetId
  }
  if (isWizardEditorGameMapItemType(item.type)) {
    next.imageStorageId = projected.imageAssetId as string | null
    delete next.imageAssetId
    if (Array.isArray(projected.layers)) {
      next.layers = projected.layers.map((layer) => {
        const nextLayer = { ...(layer as Record<string, unknown>) }
        nextLayer.imageStorageId = nextLayer.imageAssetId
        delete nextLayer.imageAssetId
        return nextLayer
      })
    }
  }

  return next
}
