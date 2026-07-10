import type { SidebarItemId } from 'shared/common/ids'
import {
  completeWizardEditorResourceCommand,
  WIZARD_EDITOR_RESOURCE_COMMAND_TYPE,
  WIZARD_EDITOR_RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorItem,
  WizardEditorResourceCatalog,
  WizardEditorResourceCatalogCommand,
  WizardEditorResourceCommandResult,
  WizardEditorResourceEvent,
} from '@wizard-archive/editor/adapter'
import { localItemTypeForSidebarItemType } from './local-workspace-model'

export function createCompletedLocalFileSystemCommandResult(
  command: WizardEditorResourceCatalogCommand,
  {
    catalog,
    claimNextItemIndex,
  }: {
    catalog: WizardEditorResourceCatalog
    claimNextItemIndex: () => number
  },
): WizardEditorResourceCommandResult {
  const events = planLocalFileSystemCommandEvents(command, {
    catalog,
    claimNextItemIndex,
  })
  return completeWizardEditorResourceCommand(command, events)
}

function planLocalFileSystemCommandEvents(
  command: WizardEditorResourceCatalogCommand,
  {
    catalog,
    claimNextItemIndex,
  }: {
    catalog: WizardEditorResourceCatalog
    claimNextItemIndex: () => number
  },
): Array<WizardEditorResourceEvent> {
  switch (command.type) {
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.move:
      if (!isActiveFolderTarget(catalog, command.targetParentId)) return []
      return collectLocalMoveEvents(catalog, command.itemIds, command.targetParentId)
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.copy:
      if (!isActiveFolderTarget(catalog, command.targetParentId)) return []
      return collectLocalCopyEvents(catalog, command.itemIds, claimNextItemIndex)
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.trash:
      return collectLocalOperationTree(catalog, command.itemIds, 'active').map((item) => ({
        type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.trashed,
        itemId: item.id,
      }))
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.restore:
      if (!isActiveFolderTarget(catalog, command.targetParentId)) return []
      return collectLocalOperationTree(catalog, command.itemIds, 'trash').map((item) => ({
        type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.restored,
        itemId: item.id,
      }))
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.deleteForever:
      return collectLocalOperationTree(catalog, command.itemIds, 'trash').map((item) => ({
        type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.deletedForever,
        itemId: item.id,
      }))
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.emptyTrash:
      return catalog.getTrashedItems().map((item) => ({
        type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.deletedForever,
        itemId: item.id,
      }))
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.toggleBookmarks:
      return Array.from(new Set(command.itemIds)).flatMap((itemId) => {
        const item = catalog.getVisibleItemById(itemId)
        return item ? [{ type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.updated, itemId: item.id }] : []
      })
  }
}

function isActiveFolderTarget(
  catalog: WizardEditorResourceCatalog,
  targetParentId: SidebarItemId | null,
) {
  if (targetParentId === null) return true
  const target = catalog.getVisibleItemById(targetParentId)
  return target?.type === 'folder'
}

function collectLocalOperationTree(
  catalog: WizardEditorResourceCatalog,
  itemIds: Array<SidebarItemId>,
  status: 'active' | 'trash',
) {
  const roots = collectLocalOperationRoots(catalog, itemIds, { status })
  return roots.flatMap((root) => [root, ...collectLocalDescendants(catalog, root.id, status)])
}

function collectLocalMoveEvents(
  catalog: WizardEditorResourceCatalog,
  itemIds: Array<SidebarItemId>,
  targetParentId: SidebarItemId | null,
): Array<WizardEditorResourceEvent> {
  const roots = collectLocalOperationRoots(catalog, itemIds, { status: 'active' })
  if (targetParentId) {
    for (const root of roots) {
      if (
        root.id === targetParentId ||
        collectLocalDescendants(catalog, root.id, 'active').some(
          (descendant) => descendant.id === targetParentId,
        )
      ) {
        return []
      }
    }
  }
  return roots.map((item) => ({ type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.moved, itemId: item.id }))
}

function collectLocalOperationRoots(
  catalog: WizardEditorResourceCatalog,
  itemIds: Array<SidebarItemId>,
  { status }: { status: 'active' | 'trash' },
) {
  const selectedItems = itemIds.flatMap((itemId) => {
    const item =
      status === 'active' ? catalog.getVisibleItemById(itemId) : catalog.getKnownItemById(itemId)
    if (!item || (status === 'trash' && !item.isTrashed)) return []
    return [item]
  })
  const selectedIds = new Set(selectedItems.map((item) => item.id))
  const rootIds = new Set<SidebarItemId>()
  const roots: Array<WizardEditorItem> = []
  for (const item of selectedItems) {
    let parentId = item.parentId
    let parentIsSelected = false
    while (parentId) {
      if (selectedIds.has(parentId)) {
        parentIsSelected = true
        break
      }
      parentId = catalog.getKnownItemById(parentId)?.parentId ?? null
    }
    if (!parentIsSelected && !rootIds.has(item.id)) {
      rootIds.add(item.id)
      roots.push(item)
    }
  }
  return roots
}

function collectLocalDescendants(
  catalog: WizardEditorResourceCatalog,
  itemId: SidebarItemId,
  status: 'active' | 'trash',
): Array<WizardEditorItem> {
  const children =
    status === 'active' ? catalog.getVisibleChildren(itemId) : catalog.getTrashedChildren(itemId)
  return children.flatMap((child) => [child, ...collectLocalDescendants(catalog, child.id, status)])
}

function collectLocalCopyEvents(
  catalog: WizardEditorResourceCatalog,
  itemIds: Array<SidebarItemId>,
  claimNextIndex: () => number,
): Array<WizardEditorResourceEvent> {
  const roots = collectLocalOperationRoots(catalog, itemIds, { status: 'active' })
  return roots.flatMap((root) => collectLocalCopyTreeEvents(root, catalog, claimNextIndex))
}

function collectLocalCopyTreeEvents(
  item: WizardEditorItem,
  catalog: WizardEditorResourceCatalog,
  claimNextIndex: () => number,
): Array<WizardEditorResourceEvent> {
  const localType = localItemTypeForSidebarItemType(item.type)
  const copiedItemId = `local-${localType}-${claimNextIndex()}` as SidebarItemId
  return [
    {
      type: WIZARD_EDITOR_RESOURCE_EVENT_TYPE.copied,
      itemId: copiedItemId,
      sourceItemId: item.id,
    },
    ...catalog
      .getVisibleChildren(item.id)
      .flatMap((child) => collectLocalCopyTreeEvents(child, catalog, claimNextIndex)),
  ]
}
