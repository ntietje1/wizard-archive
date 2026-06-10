import { PERMISSION_LEVEL } from 'shared/permissions/types'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from 'shared/sidebar-items/types'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { INITIAL_DEMO_WORKSPACE } from './demo-workspace-model'
import {
  demoCanvasForItem,
  demoFileForItem,
  demoNoteBodyForItem,
  noteBodyToBlocks,
} from './demo-workspace-model'
import type {
  EmbeddedCanvasState,
  EmbeddedCanvasStateResolver,
} from '~/features/canvas/nodes/embed/embedded-canvas-state-resolution'
import type {
  EmbedSidebarItemResolver,
  EmbedSidebarItemState,
} from '~/features/embeds/context/embed-sidebar-item-resolution'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

type DemoWorkspaceState = typeof INITIAL_DEMO_WORKSPACE

export function createDemoEmbeddedCanvasStateResolver(
  workspace: DemoWorkspaceState,
): EmbeddedCanvasStateResolver {
  return function DemoEmbeddedCanvasStateResolver({ canvasId, children }) {
    const canvas = demoCanvasForItem(workspace, String(canvasId))
    const state: EmbeddedCanvasState = {
      nodes: canvas.nodes,
      edges: canvas.edges,
      isLoading: false,
      isError: false,
    }

    return <>{children(state)}</>
  }
}

export function createDemoSidebarItemEmbedResolver(
  workspace: DemoWorkspaceState,
): EmbedSidebarItemResolver {
  return function DemoSidebarItemEmbedResolver({ target, children }) {
    if (target.kind !== 'sidebarItem') {
      return <>{children(undefined)}</>
    }

    const item = demoSidebarItemWithContent(workspace, String(target.sidebarItemId))
    const itemState: EmbedSidebarItemState = item
      ? { status: 'available', label: item.name, item }
      : {
          status: 'not_found',
          label: 'Embedded item',
          message: "This item doesn't exist.",
        }

    return <>{children(itemState)}</>
  }
}

function demoSidebarItemWithContent(
  workspace: DemoWorkspaceState,
  itemId: string,
): AnySidebarItemWithContent | null {
  const item = workspace.items.find((candidate) => candidate.id === itemId)
  if (!item) return null

  const baseItem = {
    _id: item.id as Id<'sidebarItems'>,
    _creationTime: 0,
    name: assertSidebarItemName(item.title || 'Untitled'),
    iconName: null,
    color: null,
    slug: item.id,
    campaignId: 'demo-campaign' as Id<'campaigns'>,
    parentId: null,
    allPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'demo-user' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    isActive: true,
    isTrashed: false,
    ancestors: [],
  }

  if (item.type === 'note') {
    return asDemoSidebarItem({
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.notes,
      content: noteBodyToBlocks(demoNoteBodyForItem(workspace, item.id)),
      blockMeta: {},
      blockShareAccessWarnings: [],
    })
  }

  if (item.type === 'canvas') {
    return asDemoSidebarItem({
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.canvases,
    })
  }

  if (item.type === 'map') {
    return asDemoSidebarItem({
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.gameMaps,
      imageStorageId: null,
      imageUrl: null,
      pins: [],
    })
  }

  if (item.type === 'file') {
    const file = demoFileForItem(workspace, item)

    return asDemoSidebarItem({
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.files,
      storageId: null,
      downloadUrl: null,
      contentType: file.contentType,
    })
  }

  return asDemoSidebarItem({
    ...baseItem,
    type: SIDEBAR_ITEM_TYPES.folders,
  })
}

function asDemoSidebarItem(item: unknown): AnySidebarItemWithContent {
  return item as AnySidebarItemWithContent
}
