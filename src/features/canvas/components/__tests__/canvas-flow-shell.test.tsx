import { render } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { CanvasFlowShell } from '../canvas-flow-shell'
import type { CanvasFlowShellProps } from '../canvas-flow-shell'

const reactFlowMock = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Handle: () => null,
  MiniMap: () => null,
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
  ReactFlow: (props: Record<string, unknown>) => {
    reactFlowMock.props = props
    return <div data-testid="react-flow">{props.children as React.ReactNode}</div>
  },
  ConnectionMode: {
    Loose: 'loose',
  },
  SelectionMode: {
    Partial: 'partial',
  },
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../canvas-toolbar', () => ({
  CanvasToolbar: () => null,
}))

vi.mock('../canvas-conditional-toolbar', () => ({
  CanvasConditionalToolbar: () => null,
}))

vi.mock('../canvas-local-overlays-host', () => ({
  CanvasLocalOverlaysHost: () => null,
}))

vi.mock('../canvas-awareness-host', () => ({
  CanvasAwarenessHost: () => null,
}))

vi.mock('../../runtime/context-menu/canvas-context-menu', () => ({
  CanvasContextMenu: () => null,
}))

vi.mock('../../runtime/interaction/canvas-viewport-persistence', () => ({
  CanvasViewportPersistence: () => null,
}))

vi.mock('../canvas-minimap-node', () => ({
  MiniMapNode: () => null,
}))

describe('CanvasFlowShell', () => {
  beforeEach(() => {
    reactFlowMock.props = null
  })

  it('disables React Flow double click zoom', () => {
    renderCanvasFlowShell()

    expect(reactFlowMock.props?.zoomOnDoubleClick).toBe(false)
  })

  it('uses loose connection mode so each side handle can both start and end edges', () => {
    renderCanvasFlowShell()

    expect(reactFlowMock.props?.connectionMode).toBe('loose')
  })

  it('provides canvas-owned custom edge types to React Flow', () => {
    renderCanvasFlowShell()

    expect(reactFlowMock.props?.edgeTypes).toEqual(
      expect.objectContaining({
        bezier: expect.any(Function),
      }),
    )
  })

  it('keeps persisted canvas order instead of elevating selected nodes and edges', () => {
    renderCanvasFlowShell()

    expect(reactFlowMock.props?.elevateNodesOnSelect).toBe(false)
    expect(reactFlowMock.props?.elevateEdgesOnSelect).toBe(false)
  })

  it('passes the persisted viewport into React Flow as the default viewport', () => {
    renderCanvasFlowShell()

    expect(reactFlowMock.props?.defaultViewport).toEqual({
      x: 120,
      y: -45,
      zoom: 1.5,
    })
  })
})

function createContextMenu(): CanvasFlowShellProps['contextMenu'] {
  return {
    campaignId: 'campaign-1' as never,
    canvasParentId: null,
    nodesMap: new Y.Map(),
    edgesMap: new Y.Map(),
    createNode: vi.fn(),
    screenToFlowPosition: ({ x, y }) => ({ x, y }),
    selectionController: {
      replace: vi.fn(),
      clear: vi.fn(),
    },
  }
}

function renderCanvasFlowShell() {
  return render(
    <CanvasFlowShell
      canEdit
      colorMode="light"
      chrome={{
        toolCursor: undefined,
        remoteUsers: [],
        activeTool: 'select',
        dropTarget: {
          overlayRef: createRef<HTMLDivElement>(),
          isTarget: false,
          isFileTarget: false,
        },
      }}
      canvasSurfaceRef={{ current: null }}
      contextMenu={createContextMenu()}
      viewportPersistence={{
        canvasId: 'canvas-1' as never,
        initialViewport: {
          x: 120,
          y: -45,
          zoom: 1.5,
        },
      }}
      flowHandlers={{
        onMouseMove: vi.fn(),
        onMouseLeave: vi.fn(),
      }}
    />,
  )
}
