import { useRef } from 'react'
import type { Ref } from 'react'
import type { AnyItem } from './items'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ContextMenuHostRef } from '../context-menu/components/host'
import type {
  WorkspaceContextMenuModel,
  WorkspaceContextMenuModelOptions,
} from './context-menu-model-source'
import { VIEW_CONTEXT } from './view-context'
import { buildMenu } from '../context-menu/menu-builder'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  ContextMenuGroupConfig,
} from '../context-menu/types'
import type { ViewContext, WorkspaceMenuContext } from './menu-context'

const FILESYSTEM_SELECTION_SURFACES = new Set<ViewContext>([
  VIEW_CONTEXT.SIDEBAR,
  VIEW_CONTEXT.FOLDER_VIEW,
  VIEW_CONTEXT.TRASH_VIEW,
])

interface WorkspaceContextMenuBaseOptions {
  contextOverrides?: Partial<WorkspaceMenuContext>
  itemSource: WorkspaceContextMenuItemSource
  options: WorkspaceContextMenuModelOptions
  projectItem?: (item: AnyItem) => AnyItem | undefined
}

interface WorkspaceContextMenuItemSource {
  selectedItemIds: ReadonlyArray<SidebarItemId>
  resolveOperationItems: (input: { itemIds: ReadonlyArray<SidebarItemId> }) => Array<AnyItem>
}

interface WorkspaceContextMenuBase {
  hostRef: Ref<ContextMenuHostRef>
  menuContext: WorkspaceMenuContext
}

interface BuildWorkspaceContextMenuModelInput<TServices> {
  base: WorkspaceContextMenuBase
  commands: Record<string, ContextMenuCommand<WorkspaceMenuContext, TServices>>
  contributors: ReadonlyArray<ContextMenuContributor<WorkspaceMenuContext, TServices>>
  groupConfig: ContextMenuGroupConfig
  services: TServices
}

export function useWorkspaceContextMenuBase({
  contextOverrides,
  itemSource,
  options,
  projectItem = identityItem,
}: WorkspaceContextMenuBaseOptions): WorkspaceContextMenuBase {
  const fallbackRef = useRef<ContextMenuHostRef>(null)
  const hostRef = options.ref ?? fallbackRef

  const canUseItemSelection = FILESYSTEM_SELECTION_SURFACES.has(options.viewContext)
  const clickedItem = options.item ? projectItem(options.item) : undefined
  const selectedItemIds =
    canUseItemSelection && options.item && itemSource.selectedItemIds.includes(options.item.id)
      ? itemSource.selectedItemIds
      : options.item
        ? [options.item.id]
        : []
  const selectedItems = canUseItemSelection
    ? itemSource
        .resolveOperationItems({ itemIds: selectedItemIds })
        .flatMap((item) => projectItem(item) ?? [])
    : clickedItem
      ? [clickedItem]
      : []
  const primaryItem = selectedItems[0] ?? clickedItem

  return {
    hostRef,
    menuContext: {
      surface: options.viewContext,
      item: clickedItem,
      primaryItem,
      selectedItems,
      permissionLevel: options.item?.myPermissionLevel,
      ...contextOverrides,
    },
  }
}

export function buildWorkspaceContextMenuModel<TServices>({
  base,
  commands,
  contributors,
  groupConfig,
  services,
}: BuildWorkspaceContextMenuModelInput<TServices>): WorkspaceContextMenuModel {
  const menu = buildMenu({
    context: base.menuContext,
    services,
    contributors,
    commands,
    groupConfig,
  })

  return {
    surfaceModel: { hostRef: base.hostRef, menu },
  }
}

function identityItem(item: AnyItem) {
  return item
}
