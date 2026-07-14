import { testResourceId } from '../../../../../../../shared/test/resource-id'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../../shared/permissions/types'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../../workspace/items'
import { testId } from '../../../../test/id'
import { createResourceCatalogModel } from '../../../../filesystem/catalog'
import { createWorkspaceCanvasContextMenuSource } from '../workspace-source'
import type { CanvasDocumentSession } from '../../../session-contract'
import type { CanvasContextMenuRuntime } from '../canvas-context-menu-runtime'
import type {
  CanvasContextMenuContext,
  CanvasContextMenuCreateItemSourceContext,
  CanvasContextMenuServices,
} from '../canvas-context-menu-types'

const sourceState = vi.hoisted(() => ({
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: sourceState.toastError,
  },
}))

const canvasId = testResourceId('canvas-1')
const canvasParentId = testResourceId('canvas-parent')
const createdItemId = testResourceId('created-item')

describe('createWorkspaceCanvasContextMenuSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a sidebar item through filesystem operations and embeds the new canvas node', async () => {
    const createItem = vi.fn().mockResolvedValue({
      status: 'completed',
      id: createdItemId,
    })
    const runtime = createRuntime({ createItem })
    const context = createAdapterContext()
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })

    const [noteItem] = source?.createItems?.(context) ?? []
    expect(noteItem?.id).toBe('canvas-pane-create-note')

    await act(async () => {
      await noteItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(createItem).toHaveBeenCalledWith({
      type: RESOURCE_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: canvasParentId },
      name: 'Untitled Note',
    })
    expect(context.createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'embed',
        position: { x: 21, y: 42 },
        data: expect.objectContaining({
          target: {
            kind: 'resource',
            resourceId: createdItemId,
          },
        }),
      }),
    )
    expect(context.setSelection).toHaveBeenCalledWith({
      nodeIds: new Set([expect.any(String) as string]),
      edgeIds: new Set<string>(),
    })
  })

  it('creates map menu items as game map resources with map naming', async () => {
    const createItem = vi.fn().mockResolvedValue({
      status: 'completed',
      id: createdItemId,
    })
    const runtime = createRuntime({ createItem })
    const context = createAdapterContext()
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })

    const mapItem = source
      ?.createItems?.(context)
      .find((item) => item.id === 'canvas-pane-create-map')
    expect(mapItem).toBeDefined()

    await act(async () => {
      await mapItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(createItem).toHaveBeenCalledWith({
      type: RESOURCE_TYPES.gameMaps,
      parentTarget: { kind: 'direct', parentId: canvasParentId },
      name: 'Untitled Map',
    })
  })

  it('hides create items when the canvas cannot edit', () => {
    const runtime = createRuntime()
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })

    expect(source?.createItems?.(createAdapterContext({ canEdit: false }))).toEqual([])
    expect(source?.createItems?.(createAdapterContext())).not.toEqual([])
  })

  it('keeps item creation success distinct from embed insertion failure', async () => {
    const createItem = vi.fn().mockResolvedValue({
      status: 'completed',
      id: createdItemId,
    })
    const runtime = createRuntime({ createItem })
    const context = createAdapterContext({
      createNode: vi.fn(() => {
        throw new Error('embed failed')
      }),
    })
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })

    const [noteItem] = source?.createItems?.(context) ?? []

    await act(async () => {
      await noteItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(createItem).toHaveBeenCalledTimes(1)
    expect(sourceState.toastError).toHaveBeenCalledWith(
      'Item created, but could not add it to the canvas.',
    )
  })

  it('opens sidebar embed targets through runtime navigation', async () => {
    const embeddedItem = createSidebarItem({
      id: testResourceId('note-1'),
    })
    const openItem = vi.fn()
    const runtime = createRuntime({ activeItems: [embeddedItem], openItem })
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })
    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'resource' as const, resourceId: embeddedItem.id },
    }
    const [contributor] = source?.getTargetContributors?.(target) ?? []
    const [openMenuItem] =
      contributor?.getItems?.(
        {
          ...createMenuContext(),
          target,
        },
        createMenuServices(),
      ) ?? []

    expect(openMenuItem?.label).toBe('Open')

    await act(async () => {
      await openMenuItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(openItem).toHaveBeenCalledWith(embeddedItem.id)
  })

  it('reports a stale sidebar embed target when it disappears before opening', async () => {
    const embeddedItem = createSidebarItem({
      id: testResourceId('note-1'),
    })
    const openItem = vi.fn()
    let resolveItem = true
    const runtime = createRuntime({ activeItems: [embeddedItem], openItem })
    runtime.filesystem.catalog.getKnownItemById = vi.fn(() => (resolveItem ? embeddedItem : null))
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })
    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'resource' as const, resourceId: embeddedItem.id },
    }
    const [contributor] = source?.getTargetContributors?.(target) ?? []
    const [openMenuItem] =
      contributor?.getItems?.(
        {
          ...createMenuContext(),
          target,
        },
        createMenuServices(),
      ) ?? []

    resolveItem = false

    await act(async () => {
      await openMenuItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(sourceState.toastError).toHaveBeenCalledWith(
      'Could not open item. It may have moved or been deleted.',
    )
  })

  it('opens sidebar embed targets that are hidden from the visible catalog', async () => {
    const hiddenItem = createSidebarItem({
      id: testResourceId('hidden-note'),
    })
    const openItem = vi.fn()
    const runtime = createRuntime({ activeItems: [hiddenItem], openItem, visibleItems: [] })
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })
    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'resource' as const, resourceId: hiddenItem.id },
    }
    const [contributor] = source?.getTargetContributors?.(target) ?? []
    const [openMenuItem] =
      contributor?.getItems?.(
        {
          ...createMenuContext(),
          target,
        },
        createMenuServices(),
      ) ?? []

    expect(openMenuItem?.label).toBe('Open')

    await act(async () => {
      await openMenuItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(openItem).toHaveBeenCalledWith(hiddenItem.id)
  })

  it('reveals sidebar embed targets through the workspace sidebar action', async () => {
    const embeddedItem = createSidebarItem({
      id: testResourceId('note-1'),
    })
    const showItemInSidebar = vi.fn()
    const runtime = createRuntime({ activeItems: [embeddedItem] })
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar,
    })
    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'resource' as const, resourceId: embeddedItem.id },
    }
    const contributors = source?.getTargetContributors?.(target) ?? []
    const revealItem = contributors
      .flatMap(
        (contributor) =>
          contributor.getItems?.(
            {
              ...createMenuContext(),
              target,
            },
            createMenuServices(),
          ) ?? [],
      )
      .find((item) => item.label === 'Show in Sidebar')

    expect(revealItem).toMatchObject({
      id: 'show-in-sidebar',
      label: 'Show in Sidebar',
    })

    await act(async () => {
      await revealItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(showItemInSidebar).toHaveBeenCalledWith(embeddedItem.id)
  })

  it('opens sidebar embed targets separately through runtime navigation', async () => {
    const embeddedItem = createSidebarItem({
      id: testResourceId('note-1'),
    })
    const openItem = vi.fn()
    const runtime = createRuntime({ activeItems: [embeddedItem], openItem })
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })
    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'resource' as const, resourceId: embeddedItem.id },
    }
    const openInNewTabItem = (source?.getTargetContributors?.(target) ?? [])
      .flatMap(
        (contributor) =>
          contributor.getItems?.(
            {
              ...createMenuContext(),
              target,
            },
            createMenuServices(),
          ) ?? [],
      )
      .find((item) => item.id === 'open-in-new-tab')

    expect(openInNewTabItem).toMatchObject({
      label: 'Open in New Tab',
      group: 'navigation',
    })

    await act(async () => {
      await openInNewTabItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(openItem).toHaveBeenCalledWith(embeddedItem.id, { target: 'separate' })
  })

  it('opens external embed targets through runtime navigation', async () => {
    const openExternalUrl = vi.fn()
    const runtime = createRuntime({ openExternalUrl })
    const source = createWorkspaceCanvasContextMenuSource({
      runtime,
      session: createReadySession(),
      showItemInSidebar: vi.fn(),
    })
    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'externalUrl' as const, url: 'https://example.com/file.pdf', name: 'File' },
    }
    const [contributor] = source?.getTargetContributors?.(target) ?? []
    const [openMenuItem] =
      contributor?.getItems?.(
        {
          ...createMenuContext(),
          target,
        },
        createMenuServices(),
      ) ?? []

    await act(async () => {
      await openMenuItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/file.pdf')
  })
})

function createRuntime({
  activeItems = [],
  createItem = vi.fn(),
  openItem = vi.fn(),
  openExternalUrl = vi.fn(),
  visibleItems,
}: {
  activeItems?: Array<AnyItem>
  createItem?: CanvasContextMenuRuntime['filesystem']['operations']['createItem']
  openItem?: CanvasContextMenuRuntime['navigation']['openItem']
  openExternalUrl?: CanvasContextMenuRuntime['navigation']['openExternalUrl']
  visibleItems?: Array<AnyItem>
} = {}): CanvasContextMenuRuntime {
  const catalog = createResourceCatalogModel({
    activeItems,
    visibleActiveItems: visibleItems,
    trashItems: [],
  }).catalog

  return {
    navigation: { openItem, openExternalUrl },
    filesystem: {
      catalog,
      operations: { createItem },
      permissions: { canEdit: true },
    },
  }
}

function createSidebarItem(overrides: Partial<AnyItem> = {}): AnyItem {
  return {
    id: testResourceId('note-1'),
    createdAt: 0,
    campaignId: testId<'campaigns'>('campaign-1'),
    type: RESOURCE_TYPES.notes,
    name: 'Note',
    parentId: null,
    color: null,
    iconName: null,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: testId<'userProfiles'>('user-1'),
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    isActive: true,
    isTrashed: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    ...overrides,
  } as AnyItem
}

function createReadySession(): Extract<CanvasDocumentSession, { status: 'ready' }> {
  return {
    status: 'ready',
    canvasId,
    workspaceId: testId<'campaigns'>('campaign-1'),
    canEdit: true,
    colorMode: 'light',
    doc: null as never,
    edgesMap: null as never,
    nodesMap: null as never,
    parentId: canvasParentId,
    collaboration: { status: 'unsupported' },
    user: { name: 'Demo', color: '#61afef' },
  }
}

function createAdapterContext(
  overrides: Partial<CanvasContextMenuCreateItemSourceContext> = {},
): CanvasContextMenuCreateItemSourceContext {
  return {
    canEdit: true,
    createNode: vi.fn(),
    screenToCanvasPosition: ({ x, y }) => ({ x: x + 1, y: y + 2 }),
    setSelection: vi.fn(),
    ...overrides,
  }
}

function createMenuContext(): CanvasContextMenuContext {
  return {
    surface: 'canvas',
    pointerPosition: { x: 20, y: 40 },
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
    target: { kind: 'pane' },
    canEdit: true,
  }
}

function createMenuServices(): CanvasContextMenuServices {
  return {
    hasSelectableCanvasItems: () => true,
    selectAllCanvasItems: vi.fn(),
    createEmbedNode: vi.fn(),
    createTextNode: vi.fn(),
  }
}
