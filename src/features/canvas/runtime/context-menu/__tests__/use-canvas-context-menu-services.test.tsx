import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useCanvasContextMenuServices } from '../use-canvas-context-menu-services'
import { useCanvasClipboardStore } from '../use-canvas-clipboard-store'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { Edge, Node } from '@xyflow/react'
import type { CanvasSelectionSnapshot } from '../../../tools/canvas-tool-types'

const createItemMock = vi.hoisted(() => vi.fn())
const getDefaultNameMock = vi.hoisted(() => vi.fn())
const navigateToItemMock = vi.hoisted(() => vi.fn())
const itemsMapState = vi.hoisted(() => ({
  itemsMap: new Map(),
}))

vi.mock('~/features/sidebar/hooks/useCreateSidebarItem', () => ({
  useCreateSidebarItem: () => ({
    createItem: createItemMock,
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarValidation', () => ({
  useSidebarValidation: () => ({
    getDefaultName: getDefaultNameMock,
  }),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({
    navigateToItem: navigateToItemMock,
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => itemsMapState,
}))

function createNode(id: string, x: number, zIndex: number): Node {
  return {
    id,
    type: 'text',
    position: { x, y: 0 },
    data: { label: id },
    width: 120,
    height: 36,
    zIndex,
  }
}

function createEdge(id: string, source: string, target: string, zIndex: number): Edge {
  return {
    id,
    type: 'bezier',
    source,
    target,
    zIndex,
  }
}

describe('useCanvasContextMenuServices', () => {
  beforeEach(() => {
    useCanvasClipboardStore.getState().setClipboard(null)
    createItemMock.mockReset()
    getDefaultNameMock.mockReset()
    navigateToItemMock.mockReset()
    itemsMapState.itemsMap = new Map()
  })

  it('copies selected nodes with only fully-contained edges and pastes a new selected graph', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    const replace = vi.fn()

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    nodesMap.set('node-3', createNode('node-3', 240, 3))
    edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2', 1))
    edgesMap.set('edge-2', createEdge('edge-2', 'node-2', 'node-3', 2))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        campaignId: 'campaign-1' as never,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
        selection: { replace, clear: vi.fn() },
      }),
    )

    const selection: CanvasSelectionSnapshot = {
      nodeIds: ['node-1', 'node-2'],
      edgeIds: [],
    }

    act(() => {
      expect(result.current.copySnapshot(selection)).toBe(true)
    })

    const clipboard = useCanvasClipboardStore.getState().clipboard
    expect(clipboard?.nodes).toHaveLength(2)
    expect(clipboard?.edges.map((edge) => edge.id)).toEqual(['edge-1'])

    let pastedSelection: CanvasSelectionSnapshot | null = null
    act(() => {
      pastedSelection = result.current.pasteClipboard()
    })

    expect(pastedSelection).not.toBeNull()
    if (!pastedSelection) {
      throw new Error('Expected pasted selection')
    }
    const pasted = pastedSelection as CanvasSelectionSnapshot

    expect(pasted.nodeIds).toHaveLength(2)
    expect(pasted.edgeIds).toHaveLength(1)
    expect(nodesMap.size).toBe(5)
    expect(edgesMap.size).toBe(3)
    expect(replace).toHaveBeenCalledWith(pasted)

    const pastedNodes = pasted.nodeIds.map((nodeId) => nodesMap.get(nodeId))
    expect(pastedNodes.map((node) => node?.position.x)).toEqual([32, 152])
    expect(edgesMap.get(pasted.edgeIds[0])?.source).toBe(pasted.nodeIds[0])
    expect(edgesMap.get(pasted.edgeIds[0])?.target).toBe(pasted.nodeIds[1])
  })

  it('deletes connected edges when removing selected nodes', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    const replace = vi.fn()
    const clear = vi.fn()

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2', 1))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        campaignId: 'campaign-1' as never,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
        selection: { replace, clear },
      }),
    )

    act(() => {
      expect(
        result.current.deleteSnapshot({
          nodeIds: ['node-1'],
          edgeIds: [],
        }),
      ).toBe(true)
    })

    expect(nodesMap.has('node-1')).toBe(false)
    expect(edgesMap.has('edge-1')).toBe(false)
    expect(clear).toHaveBeenCalled()
  })

  it('reorders selected nodes by updating persisted zIndex values', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    nodesMap.set('node-3', createNode('node-3', 240, 3))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        campaignId: 'campaign-1' as never,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
        selection: { replace: vi.fn(), clear: vi.fn() },
      }),
    )

    act(() => {
      expect(
        result.current.reorderSnapshot(
          {
            nodeIds: ['node-1'],
            edgeIds: [],
          },
          'bringToFront',
        ),
      ).toBe(true)
    })

    expect(nodesMap.get('node-1')?.zIndex).toBe(3)
    expect(nodesMap.get('node-2')?.zIndex).toBe(1)
    expect(nodesMap.get('node-3')?.zIndex).toBe(2)
  })

  it('reorders selected nodes and edges together when the snapshot contains both', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    nodesMap.set('node-1', createNode('node-1', 0, 1))
    nodesMap.set('node-2', createNode('node-2', 120, 2))
    nodesMap.set('node-3', createNode('node-3', 240, 3))
    edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2', 1))
    edgesMap.set('edge-2', createEdge('edge-2', 'node-2', 'node-3', 2))

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        campaignId: 'campaign-1' as never,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
        selection: { replace: vi.fn(), clear: vi.fn() },
      }),
    )

    act(() => {
      expect(
        result.current.reorderSnapshot(
          {
            nodeIds: ['node-1'],
            edgeIds: ['edge-1'],
          },
          'bringToFront',
        ),
      ).toBe(true)
    })

    expect(nodesMap.get('node-1')?.zIndex).toBe(3)
    expect(nodesMap.get('node-2')?.zIndex).toBe(1)
    expect(nodesMap.get('node-3')?.zIndex).toBe(2)
    expect(edgesMap.get('edge-1')?.zIndex).toBe(2)
    expect(edgesMap.get('edge-2')?.zIndex).toBe(1)
  })

  it('creates a new sidebar item beside the current canvas and embeds it at the clicked position', async () => {
    const createNodeMock = vi.fn()
    const replace = vi.fn()

    getDefaultNameMock.mockReturnValue('Untitled Note')
    createItemMock.mockResolvedValue({
      id: 'note-1',
      slug: 'untitled-note',
      type: SIDEBAR_ITEM_TYPES.notes,
    })
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')

    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        campaignId: 'campaign-1' as never,
        canvasParentId: 'folder-1' as never,
        nodesMap,
        edgesMap,
        createNode: createNodeMock,
        screenToFlowPosition: ({ x, y }) => ({ x: x - 4, y: y + 8 }),
        selection: { replace, clear: vi.fn() },
      }),
    )

    await act(async () => {
      await result.current.createAndEmbedSidebarItem(SIDEBAR_ITEM_TYPES.notes, { x: 100, y: 200 })
    })

    expect(getDefaultNameMock).toHaveBeenCalledWith(SIDEBAR_ITEM_TYPES.notes, 'folder-1')
    expect(createItemMock).toHaveBeenCalledWith({
      type: SIDEBAR_ITEM_TYPES.notes,
      campaignId: 'campaign-1',
      parentTarget: { kind: 'direct', parentId: 'folder-1' },
      name: 'Untitled Note',
    })
    expect(createNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        type: 'embed',
        position: { x: 96, y: 208 },
        data: { sidebarItemId: 'note-1' },
        width: 320,
        height: 240,
      }),
    )
    expect(replace).toHaveBeenCalledWith({
      nodeIds: ['00000000-0000-4000-8000-000000000001'],
      edgeIds: [],
    })
  })

  it('opens a selected embedded sidebar item in the current tab', async () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('embed-1', {
      id: 'embed-1',
      type: 'embed',
      position: { x: 0, y: 0 },
      data: { sidebarItemId: 'note-1' },
      width: 120,
      height: 80,
      zIndex: 1,
    })
    itemsMapState.itemsMap = new Map([
      [
        'note-1',
        {
          _id: 'note-1',
          slug: 'note-slug',
        },
      ],
    ])

    const { result } = renderHook(() =>
      useCanvasContextMenuServices({
        canEdit: true,
        campaignId: 'campaign-1' as never,
        canvasParentId: null,
        nodesMap,
        edgesMap,
        createNode: vi.fn(),
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
        selection: { replace: vi.fn(), clear: vi.fn() },
      }),
    )

    expect(
      result.current.canOpenEmbedSelection({
        nodeIds: ['embed-1'],
        edgeIds: [],
      }),
    ).toBe(true)

    await act(async () => {
      await result.current.openEmbedSelection({
        nodeIds: ['embed-1'],
        edgeIds: [],
      })
    })

    expect(navigateToItemMock).toHaveBeenCalledWith('note-slug')
  })
})
