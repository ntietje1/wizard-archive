import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasContextMenu } from '../use-canvas-context-menu'
import type { Edge, Node } from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import * as Y from 'yjs'
import { testId } from '~/test/helpers/test-id'
import type { CanvasContextMenuCommands } from '../canvas-context-menu-types'

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
    itemsMap: new Map(),
  }),
}))

function createSelectionController(
  snapshot: { nodeIds: Array<string>; edgeIds: Array<string> } = { nodeIds: [], edgeIds: [] },
) {
  let currentSelection = snapshot

  return {
    clear: vi.fn(() => {
      currentSelection = { nodeIds: [], edgeIds: [] }
    }),
    getSnapshot: vi.fn(() => currentSelection),
    replace: vi.fn((nextSelection) => {
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
    ...overrides,
  }
}

describe('useCanvasContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    openDocs.splice(0).forEach((doc) => doc.destroy())
  })

  it('opens the pane menu, clears selection, and derives a non-empty menu in select mode', () => {
    const selection = createSelectionController({ nodeIds: ['node-1'], edgeIds: [] })
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
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
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

    expect(selection.clear).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith({ x: 20, y: 40 })
    expect(result.current.menu.isEmpty).toBe(false)
  })

  it('selects the right-clicked node before opening the menu', () => {
    const selection = createSelectionController({ nodeIds: [], edgeIds: [] })
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
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
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

    expect(selection.replace).toHaveBeenCalledWith({ nodeIds: ['node-1'], edgeIds: [] })
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
        screenToFlowPosition: ({ x, y }) => ({ x, y }),
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
})
