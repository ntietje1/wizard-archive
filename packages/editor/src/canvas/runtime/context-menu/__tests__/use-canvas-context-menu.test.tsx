import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useCanvasContextMenu } from '../use-canvas-context-menu'
import { createEmbedNodeContextMenuContributor } from '../../../nodes/embed/embed-node-context-menu'
import { createAndSelectEmbeddedCanvasNode } from '../../document/canvas-document-commands'
import {
  TEXT_NODE_DEFAULT_HEIGHT,
  TEXT_NODE_DEFAULT_WIDTH,
} from '../../../nodes/text/text-node-constants'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { PERMISSION_LEVEL } from '../../../../../../../shared/permissions/types'
import { RESOURCE_TYPES } from '../../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../../workspace/items'
import { testId } from '../../../../test/id'
import { createCommands } from './canvas-context-menu-test-utils'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'
import type {
  CanvasDocumentEdge as Edge,
  CanvasDocumentNode as Node,
} from '../../../document-contract'
import type {
  CanvasContextMenuCreateItemSourceContext,
  CanvasContextMenuSource,
} from '../canvas-context-menu-types'

const sidebarItemsState = vi.hoisted(() => ({
  itemsMap: new Map(),
  createItem: vi.fn(),
  navigateToItem: vi.fn(),
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

const openEngines: Array<CanvasEngine> = []

function createContextMenuEngine({
  edges = [],
  nodes = [],
}: {
  edges?: ReadonlyArray<Edge>
  nodes?: ReadonlyArray<Node>
} = {}) {
  const canvasEngine = createCanvasEngine()
  openEngines.push(canvasEngine)
  canvasEngine.setDocumentSnapshot({ nodes, edges })
  return canvasEngine
}

function createContextMenuEvent(clientX: number, clientY: number) {
  return new MouseEvent('contextmenu', { clientX, clientY }) as unknown as ReactMouseEvent
}

function createMockSidebarItem(overrides: Partial<AnyItem> = {}): AnyItem {
  return {
    id: testId<'sidebarItems'>('sidebar-item-1'),
    createdAt: 0,
    campaignId: testId<'campaigns'>('campaign-1'),
    parentId: null,
    type: RESOURCE_TYPES.notes,
    name: 'Sidebar Item' as AnyItem['name'],
    iconName: null,
    color: null,
    slug: 'sidebar-item' as AnyItem['slug'],
    allPermissionLevel: null,
    status: 'active',
    previewAssetId: null,
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
  } as AnyItem
}

function createTestContextMenuSource(): CanvasContextMenuSource {
  return {
    createItems: (context) =>
      [
        { key: 'note', label: 'Note', priority: 10, type: RESOURCE_TYPES.notes },
        { key: 'folder', label: 'Folder', priority: 11, type: RESOURCE_TYPES.folders },
        { key: 'map', label: 'Map', priority: 12, type: RESOURCE_TYPES.canvases },
        { key: 'canvas', label: 'Canvas', priority: 13, type: RESOURCE_TYPES.canvases },
        { key: 'file', label: 'File', priority: 14, type: RESOURCE_TYPES.files },
      ].map((command) => ({
        id: `canvas-pane-create-${command.key}`,
        label: command.label,
        group: 'create',
        priority: command.priority,
        onSelect: async (menuContext) => {
          const result = await sidebarItemsState.createItem({
            type: command.type,
            parentTarget: { kind: 'direct', parentId: null },
            name: 'Item',
          })

          createAndSelectEmbeddedCanvasNode({
            sidebarItemId: result.id,
            pointerPosition: menuContext.pointerPosition,
            screenToCanvasPosition: context.screenToCanvasPosition,
            createNode: context.createNode,
            setSelection: context.setSelection,
          })
        },
      })),
    getTargetContributors: (target) =>
      target.kind === 'embed-node'
        ? [
            createEmbedNodeContextMenuContributor({
              canOpenEmbedTarget: (embedTarget) =>
                embedTarget.target.kind === 'resource' &&
                sidebarItemsState.itemsMap.has(embedTarget.target.resourceId),
              openEmbedTarget: async (embedTarget) => {
                if (embedTarget.target.kind !== 'resource') {
                  return false
                }

                const item = sidebarItemsState.itemsMap.get(embedTarget.target.resourceId)
                if (!item) {
                  return false
                }

                await sidebarItemsState.navigateToItem(item.slug)
                return true
              },
            }),
          ]
        : [],
  }
}

describe('useCanvasContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sidebarItemsState.itemsMap = new Map()
    sidebarItemsState.createItem.mockResolvedValue({
      id: testId<'sidebarItems'>('created-sidebar-item'),
    })
  })

  afterEach(() => {
    openEngines.splice(0).forEach((engine) => engine.destroy())
  })

  it('opens the pane menu, clears selection, and derives a non-empty menu in select mode', () => {
    const selection = createSelectionController({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set<string>(),
    })
    const canvasEngine = createContextMenuEngine()
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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

  it('passes a source-neutral create context to pane menu sources', () => {
    const selection = createSelectionController()
    const canvasEngine = createContextMenuEngine()
    const createNode = vi.fn()
    const sourceContexts: Array<CanvasContextMenuCreateItemSourceContext> = []
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        source: {
          ...createTestContextMenuSource(),
          createItems: (context) => {
            sourceContexts.push(context)
            return []
          },
        },
        createNode,
        setPendingEdit: vi.fn(),
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

    const createSubmenu = result.current.menu.flatItems.find(
      (item) => item.id === 'canvas-pane-create-submenu',
    )
    expect(createSubmenu?.children?.map((item) => item.id)).toEqual([
      'canvas-pane-create-embed',
      'canvas-pane-create-text',
    ])
    expect(sourceContexts.length).toBeGreaterThan(0)
    for (const sourceContext of sourceContexts) {
      expect(sourceContext).toEqual({
        canEdit: true,
        createNode,
        screenToCanvasPosition: expect.any(Function),
        setSelection: selection.setSelection,
      })
    }
  })

  it('uses source create actions from a source-neutral runtime context', async () => {
    const selection = createSelectionController()
    const canvasEngine = createContextMenuEngine()
    const createNode = vi.fn()
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        source: createTestContextMenuSource(),
        createNode,
        setPendingEdit: vi.fn(),
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

    const createSubmenu = result.current.menu.flatItems.find(
      (item) => item.id === 'canvas-pane-create-submenu',
    )
    expect(createSubmenu?.children?.map((item) => item.id)).toEqual([
      'canvas-pane-create-note',
      'canvas-pane-create-folder',
      'canvas-pane-create-map',
      'canvas-pane-create-canvas',
      'canvas-pane-create-file',
      'canvas-pane-create-embed',
      'canvas-pane-create-text',
    ])

    const noteItem = createSubmenu?.children?.find((item) => item.id === 'canvas-pane-create-note')
    expect(noteItem).toBeDefined()

    await act(async () => {
      await noteItem!.onSelect()
    })

    expect(sidebarItemsState.createItem).toHaveBeenCalledWith({
      type: RESOURCE_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: null },
      name: 'Item',
    })
    expect(createNode).toHaveBeenCalledTimes(1)
  })

  it('selects every canvas item from the pane menu Select All action', async () => {
    const selection = createSelectionController()
    const canvasEngine = createContextMenuEngine({
      nodes: [
        {
          id: 'node-1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {},
        } as Node,
        {
          id: 'node-2',
          type: 'text',
          position: { x: 10, y: 10 },
          data: {},
        } as Node,
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'straight',
        } as Edge,
      ],
    })
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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

  it('creates and starts editing a text node from the pane menu New submenu', async () => {
    const selection = createSelectionController()
    const canvasEngine = createContextMenuEngine()
    const createNode = vi.fn()
    const setPendingEdit = vi.fn()
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        createNode,
        setPendingEdit,
        screenToCanvasPosition: ({ x, y }) => ({ x: x + 100, y: y + 200 }),
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

    const createSubmenu = result.current.menu.flatItems.find(
      (item) => item.id === 'canvas-pane-create-submenu',
    )
    const textItem = createSubmenu?.children?.find((item) => item.id === 'canvas-pane-create-text')
    expect(textItem).toBeDefined()

    await act(async () => {
      await textItem!.onSelect()
    })

    expect(createNode).toHaveBeenCalledTimes(1)
    const createdNode = createNode.mock.calls[0]?.[0] as Node
    expect(createdNode).toEqual(
      expect.objectContaining({
        type: 'text',
        position: {
          x: 120 - TEXT_NODE_DEFAULT_WIDTH / 2,
          y: 240 - TEXT_NODE_DEFAULT_HEIGHT / 2,
        },
        width: TEXT_NODE_DEFAULT_WIDTH,
        height: TEXT_NODE_DEFAULT_HEIGHT,
      }),
    )
    expect(selection.setSelection).toHaveBeenCalledWith({
      nodeIds: new Set([createdNode.id]),
      edgeIds: new Set<string>(),
    })
    expect(setPendingEdit).toHaveBeenCalledWith({
      nodeId: createdNode.id,
      point: { x: 20, y: 40 },
    })
  })

  it('selects the right-clicked node before opening the menu', () => {
    const selection = createSelectionController()
    const node = {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const canvasEngine = createContextMenuEngine({ nodes: [node] })
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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
      result.current.openForNode(createContextMenuEvent(10, 15), node)
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
    const canvasEngine = createContextMenuEngine()
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'draw',
        canEdit: true,
        canvasEngine,
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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

    expect(result.current.menu.isEmpty).toBe(true)
  })

  it('preserves the current selection when opening a pane menu is blocked by the active tool', () => {
    const initialSelection = { nodeIds: new Set(['node-1']), edgeIds: new Set<string>() }
    const selection = createSelectionController(initialSelection)
    const canvasEngine = createContextMenuEngine()
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'draw',
        canEdit: true,
        canvasEngine,
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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
      result.current.openForPane(createContextMenuEvent(1, 2))
    })

    expect(selection.getSnapshot()).toEqual(initialSelection)
  })

  it('preserves the current selection when node and edge menus are blocked by the active tool', () => {
    const initialSelection = { nodeIds: new Set(['node-1']), edgeIds: new Set<string>() }
    const selection = createSelectionController(initialSelection)
    const node = {
      id: 'node-2',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const edge = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'straight',
    } as Edge
    const canvasEngine = createContextMenuEngine({ nodes: [node], edges: [edge] })
    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'draw',
        canEdit: true,
        canvasEngine,
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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
      result.current.openForNode(createContextMenuEvent(1, 2), node)
      result.current.openForEdge(createContextMenuEvent(3, 4), edge)
    })

    expect(selection.getSnapshot()).toEqual(initialSelection)
  })

  it('adds embed-node contributors for a single selected embed node', () => {
    const selection = createSelectionController({
      nodeIds: new Set(['embed-1']),
      edgeIds: new Set<string>(),
    })
    sidebarItemsState.itemsMap.set(
      'note-1',
      createMockSidebarItem({
        id: testId<'sidebarItems'>('note-1'),
        slug: 'note-1' as AnyItem['slug'],
      }),
    )
    const embedNode = {
      id: 'embed-1',
      type: 'embed',
      position: { x: 0, y: 0 },
      width: 200,
      height: 120,
      data: { target: { kind: 'resource', resourceId: 'note-1' } },
    } as Node
    const canvasEngine = createContextMenuEngine({ nodes: [embedNode] })

    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        source: createTestContextMenuSource(),
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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
      result.current.openForNode(createContextMenuEvent(25, 30), embedNode)
    })

    expect(open).toHaveBeenCalledWith({ x: 25, y: 30 })
    expect(result.current.menu.flatItems.some((item) => item.label === 'Open')).toBe(true)
  })

  it('refreshes embed-node contributors when active sidebar items are replaced while open', () => {
    const selection = createSelectionController({
      nodeIds: new Set(['embed-1']),
      edgeIds: new Set<string>(),
    })
    sidebarItemsState.itemsMap.set(
      'note-1',
      createMockSidebarItem({
        id: testId<'sidebarItems'>('note-1'),
        slug: 'note-1' as AnyItem['slug'],
      }),
    )
    const embedNode = {
      id: 'embed-1',
      type: 'embed',
      position: { x: 0, y: 0 },
      width: 200,
      height: 120,
      data: { target: { kind: 'resource', resourceId: 'note-1' } },
    } as Node
    const canvasEngine = createContextMenuEngine({ nodes: [embedNode] })

    const { rerender, result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        source: createTestContextMenuSource(),
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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
      result.current.openForNode(createContextMenuEvent(25, 30), embedNode)
    })

    expect(result.current.menu.flatItems.some((item) => item.label === 'Open')).toBe(true)

    sidebarItemsState.itemsMap = new Map()
    rerender()

    expect(result.current.menu.flatItems.some((item) => item.label === 'Open')).toBe(false)
  })

  it('keeps mixed selections on the shared selection menu', () => {
    const selection = createSelectionController({
      nodeIds: new Set(['node-1']),
      edgeIds: new Set(['edge-1']),
    })
    const node = {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Node
    const edge = {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-1',
      type: 'straight',
    } as Edge
    const canvasEngine = createContextMenuEngine({ nodes: [node], edges: [edge] })

    const { result } = renderHook(() =>
      useCanvasContextMenu({
        activeTool: 'select',
        canEdit: true,
        canvasEngine,
        createNode: vi.fn(),
        setPendingEdit: vi.fn(),
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
      result.current.openForEdge(createContextMenuEvent(50, 60), edge)
    })

    expect(open).toHaveBeenCalledWith({ x: 50, y: 60 })
    expect(result.current.menu.isEmpty).toBe(false)
    expect(result.current.menu.flatItems.some((item) => item.label === 'Open')).toBe(false)
  })
})
