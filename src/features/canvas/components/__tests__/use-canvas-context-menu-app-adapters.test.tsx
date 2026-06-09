import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasContextMenuAppAdapters } from '../use-canvas-context-menu-app-adapters'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from 'shared/sidebar-items/types'
import { testId } from '~/test/helpers/test-id'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type {
  CanvasContextMenuContext,
  CanvasContextMenuCreateItemContext,
  CanvasContextMenuServices,
} from '../../runtime/context-menu/canvas-context-menu-types'

const appState = vi.hoisted(() => ({
  createItem: vi.fn(),
  getDefaultName: vi.fn(),
  itemsMap: new Map(),
  filteredItemsMap: new Map(),
  loggerError: vi.fn(),
  navigateToItem: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({
    createItem: appState.createItem,
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({
    getDefaultName: appState.getDefaultName,
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({
    navigateToItem: appState.navigateToItem,
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => ({
    itemsMap: appState.itemsMap,
  }),
}))

vi.mock('~/features/sidebar/hooks/useFilteredSidebarItems', () => ({
  useFilteredSidebarItems: () => ({
    itemsMap: appState.filteredItemsMap,
  }),
}))

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    error: appState.loggerError,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: appState.toastError,
  },
}))

function createMockSidebarItem(overrides: Partial<AnySidebarItem> = {}): AnySidebarItem {
  return {
    _id: testId<'sidebarItems'>('note-1'),
    _creationTime: 0,
    campaignId: testId<'campaigns'>('campaign-1'),
    type: SIDEBAR_ITEM_TYPES.notes,
    name: 'Note',
    slug: 'note-1' as AnySidebarItem['slug'],
    parentId: null,
    color: null,
    iconName: null,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
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
  } as AnySidebarItem
}

function createAdapterContext(
  overrides: Partial<CanvasContextMenuCreateItemContext> = {},
): CanvasContextMenuCreateItemContext {
  return {
    campaignId: testId<'campaigns'>('campaign-1'),
    canEdit: true,
    canvasParentId: testId<'sidebarItems'>('canvas-parent'),
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

describe('useCanvasContextMenuAppAdapters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appState.itemsMap = new Map()
    appState.filteredItemsMap = new Map()
    appState.createItem.mockResolvedValue({ id: testId<'sidebarItems'>('created-item') })
    appState.getDefaultName.mockReturnValue('Untitled note')
    vi.stubGlobal('open', vi.fn())
  })

  it('creates a sidebar item and embeds the new canvas node from a create action', async () => {
    const context = createAdapterContext()
    const { result } = renderHook(() => useCanvasContextMenuAppAdapters())

    const [noteItem] = result.current.createItems?.(context) ?? []
    expect(noteItem?.id).toBe('canvas-pane-create-note')
    expect(noteItem?.onSelect).toBeDefined()

    await act(async () => {
      await noteItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(appState.getDefaultName).toHaveBeenCalledWith(
      SIDEBAR_ITEM_TYPES.notes,
      context.canvasParentId,
    )
    expect(appState.createItem).toHaveBeenCalledWith({
      type: SIDEBAR_ITEM_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: context.canvasParentId },
      name: 'Untitled note',
    })
    expect(context.createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'embed',
        position: { x: 21, y: 42 },
        data: expect.objectContaining({
          target: {
            kind: 'sidebarItem',
            sidebarItemId: testId<'sidebarItems'>('created-item'),
          },
        }),
      }),
    )
    expect(context.setSelection).toHaveBeenCalledWith({
      nodeIds: new Set([expect.any(String) as string]),
      edgeIds: new Set<string>(),
    })
  })

  it('surfaces create failures while keeping diagnostic context in logs', async () => {
    const error = new Error('create failed')
    appState.createItem.mockRejectedValue(error)
    const context = createAdapterContext()
    const { result } = renderHook(() => useCanvasContextMenuAppAdapters())
    const [noteItem] = result.current.createItems?.(context) ?? []
    expect(noteItem?.onSelect).toBeDefined()

    await act(async () => {
      await noteItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(appState.loggerError).toHaveBeenCalledWith(
      'Failed to create embedded sidebar item from canvas context menu',
      expect.objectContaining({
        campaignId: context.campaignId,
        canvasParentId: context.canvasParentId,
        pointerPosition: { x: 20, y: 40 },
        type: SIDEBAR_ITEM_TYPES.notes,
        error,
      }),
    )
    expect(appState.toastError).toHaveBeenCalledWith('Could not create item. Please try again.')
    expect(context.createNode).not.toHaveBeenCalled()
  })

  it('opens embed targets through the sidebar navigation adapter', async () => {
    const item = createMockSidebarItem({
      _id: testId<'sidebarItems'>('note-1'),
      slug: 'note-1' as AnySidebarItem['slug'],
    })
    appState.itemsMap.set(testId<'sidebarItems'>('note-1'), item)
    appState.filteredItemsMap.set(testId<'sidebarItems'>('note-1'), item)
    const { result } = renderHook(() => useCanvasContextMenuAppAdapters())

    const [contributor] =
      result.current.getTargetContributors?.({
        kind: 'embed-node',
        nodeId: 'embed-1',
        nodeType: 'embed',
        target: { kind: 'sidebarItem', sidebarItemId: testId<'sidebarItems'>('note-1') },
      }) ?? []
    const [openItem] = contributor?.getItems?.(
      {
        ...createMenuContext(),
        target: {
          kind: 'embed-node',
          nodeId: 'embed-1',
          nodeType: 'embed',
          target: { kind: 'sidebarItem', sidebarItemId: testId<'sidebarItems'>('note-1') },
        },
      },
      {
        ...createMenuServices(),
      },
    ) ?? [null]

    expect(openItem?.label).toBe('Open')
    expect(openItem?.onSelect).toBeDefined()

    await act(async () => {
      await openItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(appState.navigateToItem).toHaveBeenCalledWith('note-1')
  })

  it('does not offer open actions for unreadable sidebar embed targets', () => {
    appState.itemsMap.set(
      testId<'sidebarItems'>('note-1'),
      createMockSidebarItem({
        _id: testId<'sidebarItems'>('note-1'),
        slug: 'note-1' as AnySidebarItem['slug'],
        myPermissionLevel: PERMISSION_LEVEL.NONE,
      }),
    )
    const { result } = renderHook(() => useCanvasContextMenuAppAdapters())

    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'sidebarItem' as const, sidebarItemId: testId<'sidebarItems'>('note-1') },
    }
    const [contributor] = result.current.getTargetContributors?.(target) ?? []
    const items =
      contributor?.getItems?.(
        {
          ...createMenuContext(),
          target,
        },
        createMenuServices(),
      ) ?? []

    expect(items).toEqual([])
  })

  it('opens external embed targets in a new browser tab', async () => {
    const { result } = renderHook(() => useCanvasContextMenuAppAdapters())
    const target = {
      kind: 'embed-node' as const,
      nodeId: 'embed-1',
      nodeType: 'embed' as const,
      target: { kind: 'externalUrl' as const, url: 'https://example.com/file.pdf', name: 'File' },
    }

    const [contributor] = result.current.getTargetContributors?.(target) ?? []
    const [openItem] = contributor?.getItems?.(
      {
        ...createMenuContext(),
        target,
      },
      createMenuServices(),
    ) ?? [null]

    expect(openItem?.label).toBe('Open')

    await act(async () => {
      await openItem!.onSelect!(createMenuContext(), createMenuServices(), undefined)
    })

    expect(window.open).toHaveBeenCalledWith(
      'https://example.com/file.pdf',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
