import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasContextMenu } from '../use-canvas-context-menu'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '~/features/canvas/types/canvas-domain-types'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'
import type { CanvasContextMenuCommands } from '../canvas-context-menu-types'
import type { CanvasSelectionSnapshot } from '../../../tools/canvas-tool-types'

const sidebarItemsState = vi.hoisted(() => ({
  itemsMap: new Map(),
}))

vi.mock('~/features/sidebar/hooks/useCreateSidebarItem', () => ({
  useCreateSidebarItem: () => ({
    createItem: vi.fn(),
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({
    getDefaultName: vi.fn(() => 'Item'),
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({
    navigateToItem: vi.fn(),
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => ({
    itemsMap: sidebarItemsState.itemsMap,
  }),
}))

function createSelectionController(
  snapshot: CanvasSelectionSnapshot = { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
) {
  let currentSelection = snapshot

  return {
    clearSelection: vi.fn(() => {
      currentSelection = { nodeIds: new Set<string>(), edgeIds: new Set<string>() }
    }),
    getSnapshot: vi.fn(() => currentSelection),
    setSelection: vi.fn((nextSelection) => {
      currentSelection = nextSelection
    }),
  }
}

const openDocs: Array<Y.Doc> = []
const testCampaignId = testId<'campaigns'>('campaign-1')

function createContextMenuDoc() {
  const doc = new Y.Doc()
  openDocs.push(doc)
  return {
    doc,
    nodesMap: doc.getMap<Node>('nodes'),
    edgesMap: doc.getMap<Edge>('edges'),
  }
}

function createContextMenuEvent(clientX: number, clientY: number) {
  return new MouseEvent('contextmenu', { clientX, clientY }) as unknown as ReactMouseEvent
}

function createCommands(
  overrides: Partial<CanvasContextMenuCommands> = {},
): CanvasContextMenuCommands {
  return {
    copy: {
      id: 'copy',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    cut: {
      id: 'cut',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    paste: {
      id: 'paste',
      canRun: vi.fn(() => false),
      run: vi.fn(() => null),
    },
    duplicate: {
      id: 'duplicate',
      canRun: vi.fn(() => true),
      run: vi.fn(() => null),
    },
    delete: {
      id: 'delete',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    reorder: {
      id: 'reorder',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    arrange: {
      id: 'arrange',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    ...overrides,
  }
}

function createMockSidebarItem(overrides: Partial<AnySidebarItem> = {}): AnySidebarItem {
  return {
    _id: testId<'sidebarItems'>('sidebar-item-1'),
    _creationTime: 0,
    campaignId: testId<'campaigns'>('campaign-1'),
    parentId: null,
    type: SIDEBAR_ITEM_TYPES.notes,
    name: 'Sidebar Item' as AnySidebarItem['name'],
    iconName: null,
    color: null,
    slug: 'sidebar-item' as AnySidebarItem['slug'],
    allPermissionLevel: null,
    location: 'sidebar',
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
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    ...overrides,
  } as AnySidebarItem
}

describe('useCanvasContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sidebarItemsState.itemsMap.clear()
  })

  afterEach(() => {
    openDocs.splice(0).forEach((doc) => doc.destroy())
  })

  it('opens the pane menu, clears selection, and derives a non-empty menu in select mode', () => {
    const selection = createSelectionController({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    const { nodesMap, edgesMap } = createContextMenuDoc()
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        campaignId: testCampaignId,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        selection,
        commands: createCommands(),
      }),
    )

    const open = vi.fn()
    result.current.hostRef.current = {
      open,
      close: vi.fn(),
    }

    act(() => {
      result.current.openForPane(createContextMenuEvent(20, 40))
    })

    expect(selection.clearSelection).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith({ x: 20, y: 40 })
    expect(result.current.menu.isEmpty).toBe(false)
  })

  it('selects every canvas item from the pane menu Select All action', async () => {
    const selection = createSelectionController()
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('node-1', {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node)
    nodesMap.set('node-2', {
      id: 'node-2',
      type: 'text',
      position: { x: 10, y: 10 },
      data: {},
    } as Node)
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'straight',
    } as Edge)
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        campaignId: testCampaignId,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        selection,
        commands: createCommands(),
      }),
    )

    result.current.hostRef.current = {
      open: vi.fn(),
      close: vi.fn(),
    }

    act(() => {
      result.current.openForPane(createContextMenuEvent(20, 40))
    })

    const selectAllItem = result.current.menu.flatItems.find((item) => item.label === 'Select All')
    expect(selectAllItem).toBeDefined()
    expect(selectAllItem?.disabled).toBe(false)

    await act(async () => {
      await selectAllItem!.onSelect()
    })

    expect(selection.setSelection).toHaveBeenCalledWith({
      nodeIds: new Set(['node-1', 'node-2']),
      edgeIds: new Set(['edge-1']),
    })
  })

  it('selects the right-clicked node before opening the menu', () => {
    const selection = createSelectionController()
    const { nodesMap, edgesMap } = createContextMenuDoc()
    nodesMap.set('node-1', {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node)
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        campaignId: testCampaignId,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        selection,
        commands: createCommands(),
      }),
    )

    const open = vi.fn()
    result.current.hostRef.current = {
      open,
      close: vi.fn(),
    }

    act(() => {
      result.current.openForNode(createContextMenuEvent(10, 15), nodesMap.get('node-1')!)
    })

    expect(selection.setSelection).toHaveBeenCalledWith({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    expect(open).toHaveBeenCalledWith({ x: 10, y: 15 })
    expect(result.current.menu.isEmpty).toBe(false)
  })

  it('does not open when a non-select tool is active', () => {
    const selection = createSelectionController()
    const { nodesMap, edgesMap } = createContextMenuDoc()
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'draw',
        canEdit: true,
        campaignId: testCampaignId,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        selection,
        commands: createCommands(),
      }),
    )

    const open = vi.fn()
    result.current.hostRef.current = {
      open,
      close: vi.fn(),
    }

    act(() => {
      result.current.openForPane(createContextMenuEvent(1, 2))
    })

    expect(open).not.toHaveBeenCalled()
    expect(result.current.menu.isEmpty).toBe(true)
  })

  it('adds embed-node contributors for a single selected embed node', () => {
    const selection = createSelectionController({
      nodeIds: new Set(['embed-1']),
      edgeIds: new Set<string>(),
    })
    const { nodesMap, edgesMap } = createContextMenuDoc()
    sidebarItemsState.itemsMap.set(
      'note-1',
      createMockSidebarItem({
        _id: testId<'sidebarItems'>('note-1'),
        slug: 'note-1' as AnySidebarItem['slug'],
      }),
    )
    nodesMap.set('embed-1', {
      id: 'embed-1',
      type: 'embed',
      position: { x: 0, y: 0 },
      width: 200,
      height: 120,
      data: { sidebarItemId: 'note-1' },
    } as Node)

    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        campaignId: testCampaignId,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        selection,
        commands: createCommands(),
      }),
    )

    const open = vi.fn()
    result.current.hostRef.current = {
      open,
      close: vi.fn(),
    }

    act(() => {
      result.current.openForNode(createContextMenuEvent(25, 30), nodesMap.get('embed-1')!)
    })

    expect(open).toHaveBeenCalledWith({ x: 25, y: 30 })
    expect(result.current.menu.flatItems.some((item) => item.label === 'Open')).toBe(true)
  })

  it('keeps mixed (node+edge) selections on the shared selection menu without crashing on malformed items', () => {
    const selection = createSelectionController({
      nodeIds: new Set(['bad-node']),
      edgeIds: new Set(['edge-1']),
    })
    const { nodesMap, edgesMap } = createContextMenuDoc()
    // Intentionally corrupt node data to simulate unexpected persisted runtime state.
    nodesMap.set('bad-node', {
      id: 'bad-node',
      type: 'text',
      position: { x: 0, y: 0 },
      data: null,
    } as never)
    edgesMap.set('edge-1', {
      id: 'edge-1',
      source: 'source',
      target: 'target',
      type: 'straight',
    } as Edge)

    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        campaignId: testCampaignId,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        selection,
        commands: createCommands(),
      }),
    )

    const open = vi.fn()
    result.current.hostRef.current = {
      open,
      close: vi.fn(),
    }

    act(() => {
      result.current.openForEdge(createContextMenuEvent(50, 60), edgesMap.get('edge-1')!)
    })

    expect(open).toHaveBeenCalledWith({ x: 50, y: 60 })
    expect(result.current.menu.isEmpty).toBe(false)
    expect(result.current.menu.flatItems.some((item) => item.label === 'Open')).toBe(false)
  })
})
