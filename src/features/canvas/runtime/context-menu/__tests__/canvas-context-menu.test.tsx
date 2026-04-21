import { act, render, waitFor } from '@testing-library/react'
import { createRef, forwardRef, useImperativeHandle } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { CanvasContextMenu } from '../canvas-context-menu'
import { useCanvasClipboardStore } from '../use-canvas-clipboard-store'
import { useCanvasSelectionState } from '../../selection/use-canvas-selection-state'
import type { Edge, Node } from '@xyflow/react'
import type { CanvasContextMenuRef } from '../canvas-context-menu'
import type { BuiltContextMenu } from '~/features/context-menu/types'

const hostMock = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  menu: null as BuiltContextMenu | null,
}))

const createItemMock = vi.hoisted(() => vi.fn())
const getDefaultNameMock = vi.hoisted(() => vi.fn())
const navigateToItemMock = vi.hoisted(() => vi.fn())
const itemsMapState = vi.hoisted(() => ({
  itemsMap: new Map(),
}))

vi.mock('~/features/context-menu/components/context-menu-host', () => ({
  ContextMenuHost: forwardRef((props: { menu: BuiltContextMenu }, ref) => {
    hostMock.menu = props.menu
    useImperativeHandle(ref, () => ({
      open: hostMock.open,
      close: hostMock.close,
    }))
    return null
  }),
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

function createNode(
  id: string,
  type = 'text',
  data: Record<string, unknown> = { label: id },
): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data,
    zIndex: 1,
  }
}

function createEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    type: 'bezier',
    source,
    target,
    zIndex: 1,
  }
}

describe('CanvasContextMenu', () => {
  beforeEach(() => {
    let nextRafId = 1
    hostMock.open.mockReset()
    hostMock.close.mockReset()
    hostMock.menu = null
    createItemMock.mockReset()
    getDefaultNameMock.mockReset()
    navigateToItemMock.mockReset()
    itemsMapState.itemsMap = new Map()
    useCanvasClipboardStore.getState().setClipboard(null)
    useCanvasSelectionState.getState().reset()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0)
        const rafId = nextRafId
        nextRafId += 1
        return rafId
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('only opens the canvas context menu on the select tool', () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    const selectionController = { replace: vi.fn(), clear: vi.fn() }
    const ref = createRef<CanvasContextMenuRef>()

    render(
      <CanvasContextMenu
        ref={ref}
        activeTool="draw"
        canEdit={true}
        campaignId={'campaign-1' as never}
        canvasParentId={null}
        nodesMap={nodesMap}
        edgesMap={edgesMap}
        createNode={vi.fn()}
        screenToFlowPosition={({ x, y }) => ({ x, y })}
        selectionController={selectionController}
      />,
    )

    act(() => {
      ref.current?.onPaneContextMenu(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 20,
        }),
      )
    })

    expect(hostMock.open).not.toHaveBeenCalled()
  })

  it('can reopen the menu through successive pane context menu events', async () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    const selectionController = { replace: vi.fn(), clear: vi.fn() }
    const ref = createRef<CanvasContextMenuRef>()

    render(
      <CanvasContextMenu
        ref={ref}
        activeTool="select"
        canEdit={true}
        campaignId={'campaign-1' as never}
        canvasParentId={null}
        nodesMap={nodesMap}
        edgesMap={edgesMap}
        createNode={vi.fn()}
        screenToFlowPosition={({ x, y }) => ({ x, y })}
        selectionController={selectionController}
      />,
    )

    act(() => {
      ref.current?.onPaneContextMenu(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 20,
        }),
      )
    })
    await waitFor(() => {
      expect(hostMock.open).toHaveBeenCalledWith({ x: 10, y: 20 })
    })

    act(() => {
      ref.current?.close()
      ref.current?.onPaneContextMenu(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 30,
          clientY: 40,
        }),
      )
    })

    await waitFor(() => {
      expect(hostMock.open).toHaveBeenCalledWith({ x: 30, y: 40 })
    })
  })

  it('clears the current selection before opening the pane menu', async () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    useCanvasSelectionState.getState().setSelection({ nodeIds: ['node-1'], edgeIds: ['edge-1'] })

    const selectionController = { replace: vi.fn(), clear: vi.fn() }
    const ref = createRef<CanvasContextMenuRef>()

    render(
      <CanvasContextMenu
        ref={ref}
        activeTool="select"
        canEdit={true}
        campaignId={'campaign-1' as never}
        canvasParentId={null}
        nodesMap={nodesMap}
        edgesMap={edgesMap}
        createNode={vi.fn()}
        screenToFlowPosition={({ x, y }) => ({ x, y })}
        selectionController={selectionController}
      />,
    )

    act(() => {
      ref.current?.onPaneContextMenu(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 12,
          clientY: 18,
        }),
      )
    })

    await waitFor(() => {
      expect(hostMock.open).toHaveBeenCalledWith({ x: 12, y: 18 })
    })

    expect(selectionController.clear).toHaveBeenCalledTimes(1)
    expect(hostMock.menu?.flatItems.map((item) => item.id)).toEqual(
      expect.arrayContaining(['canvas-pane-create-submenu', 'canvas-pane-paste']),
    )
  })

  it('selects an unselected target before opening a selection-driven menu', async () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', createNode('node-1'))
    nodesMap.set('node-2', createNode('node-2'))
    useCanvasSelectionState.getState().setSelection({ nodeIds: ['node-1'], edgeIds: [] })

    const selectionController = { replace: vi.fn(), clear: vi.fn() }
    const ref = createRef<CanvasContextMenuRef>()

    render(
      <CanvasContextMenu
        ref={ref}
        activeTool="select"
        canEdit={true}
        campaignId={'campaign-1' as never}
        canvasParentId={null}
        nodesMap={nodesMap}
        edgesMap={edgesMap}
        createNode={vi.fn()}
        screenToFlowPosition={({ x, y }) => ({ x, y })}
        selectionController={selectionController}
      />,
    )

    act(() => {
      ref.current?.onNodeContextMenu(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 24,
          clientY: 48,
        }) as unknown as React.MouseEvent,
        createNode('node-2'),
      )
    })

    await waitFor(() => {
      expect(hostMock.open).toHaveBeenCalledWith({ x: 24, y: 48 })
    })

    expect(selectionController.replace).toHaveBeenCalledWith({
      nodeIds: ['node-2'],
      edgeIds: [],
    })
    expect(selectionController.clear).not.toHaveBeenCalled()
    expect(hostMock.menu?.flatItems.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'canvas-selection-reorder',
        'canvas-selection-copy',
        'canvas-selection-delete',
      ]),
    )
    expect(hostMock.menu?.flatItems.map((item) => item.id)).not.toContain(
      'canvas-pane-create-submenu',
    )

    const reorderItems = hostMock.menu?.flatItems.filter((item) => item.label === 'Reorder') ?? []
    expect(reorderItems).toHaveLength(1)
    expect(reorderItems[0]?.id).toBe('canvas-selection-reorder')
  })

  it('shows reorder only once for a mixed multi-selection and uses the selection scope', async () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('node-1', createNode('node-1'))
    nodesMap.set('node-2', createNode('node-2'))
    edgesMap.set('edge-1', createEdge('edge-1', 'node-1', 'node-2'))
    useCanvasSelectionState.getState().setSelection({
      nodeIds: ['node-1', 'node-2'],
      edgeIds: ['edge-1'],
    })

    const selectionController = { replace: vi.fn(), clear: vi.fn() }
    const ref = createRef<CanvasContextMenuRef>()

    render(
      <CanvasContextMenu
        ref={ref}
        activeTool="select"
        canEdit={true}
        campaignId={'campaign-1' as never}
        canvasParentId={null}
        nodesMap={nodesMap}
        edgesMap={edgesMap}
        createNode={vi.fn()}
        screenToFlowPosition={({ x, y }) => ({ x, y })}
        selectionController={selectionController}
      />,
    )

    act(() => {
      ref.current?.onNodeContextMenu(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 80,
          clientY: 96,
        }) as unknown as React.MouseEvent,
        createNode('node-1'),
      )
    })

    await waitFor(() => {
      expect(hostMock.open).toHaveBeenCalledWith({ x: 80, y: 96 })
    })

    const reorderItems = hostMock.menu?.flatItems.filter((item) => item.label === 'Reorder') ?? []
    expect(reorderItems).toHaveLength(1)
    expect(reorderItems[0]?.id).toBe('canvas-selection-reorder')
    expect(reorderItems[0]?.scope).toBe('selection')
  })

  it('adds an Open action for a single embedded sidebar item selection', async () => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<Node>('nodes')
    const edgesMap = doc.getMap<Edge>('edges')
    nodesMap.set('embed-1', createNode('embed-1', 'embed', { sidebarItemId: 'note-1' }))
    itemsMapState.itemsMap = new Map([
      [
        'note-1',
        {
          _id: 'note-1',
          slug: 'note-slug',
        },
      ],
    ])

    const selectionController = { replace: vi.fn(), clear: vi.fn() }
    const ref = createRef<CanvasContextMenuRef>()

    render(
      <CanvasContextMenu
        ref={ref}
        activeTool="select"
        canEdit={true}
        campaignId={'campaign-1' as never}
        canvasParentId={null}
        nodesMap={nodesMap}
        edgesMap={edgesMap}
        createNode={vi.fn()}
        screenToFlowPosition={({ x, y }) => ({ x, y })}
        selectionController={selectionController}
      />,
    )

    act(() => {
      ref.current?.onNodeContextMenu(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 24,
          clientY: 48,
        }) as unknown as React.MouseEvent,
        createNode('embed-1', 'embed', { sidebarItemId: 'note-1' }),
      )
    })

    await waitFor(() => {
      expect(hostMock.open).toHaveBeenCalledWith({ x: 24, y: 48 })
    })

    const openItem = hostMock.menu?.flatItems.find((item) => item.id === 'embed-node-open')
    expect(openItem?.label).toBe('Open')

    await act(async () => {
      await openItem?.onSelect()
    })

    expect(navigateToItemMock).toHaveBeenCalledWith('note-slug')
  })
})
