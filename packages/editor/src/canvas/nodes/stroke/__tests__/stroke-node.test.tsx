import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { CanvasRenderModeContext } from '../../../runtime/providers/canvas-render-mode-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import { CANVAS_NODE_MIN_SIZE } from '../../shared/canvas-node-resize-constants'
import { getCachedStrokeDetailPath } from '../stroke-path-cache'
import { StrokeNode } from '../stroke-node'

let strokeEngine!: CanvasEngine
const strokeNodeMocks = vi.hoisted(() => ({
  localOverlayState: {
    eraseErasingStrokeIds: new Set<string>(),
  },
  localOverlayStore: {
    getInitialState: () => strokeNodeMocks.localOverlayState,
    getState: () => strokeNodeMocks.localOverlayState,
    subscribe: vi.fn(() => vi.fn()),
  },
  registerStrokeNodePaths: vi.fn(() => vi.fn()),
  resizableNodeWrapper: vi.fn(),
}))

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: (props: {
    children: ReactNode
    chrome?: ReactNode
    minHeight?: number
    minWidth?: number
    nodeType: string
  }) => {
    strokeNodeMocks.resizableNodeWrapper(props)
    return (
      <div>
        {props.chrome}
        {props.children}
      </div>
    )
  },
}))

vi.mock('../../../runtime/providers/canvas-runtime', () => ({
  useCanvasToolLocalOverlayRuntimeStore: () => strokeNodeMocks.localOverlayStore,
  useCanvasViewportRuntime: () => ({
    domRuntime: {
      registerStrokeNodePaths: strokeNodeMocks.registerStrokeNodePaths,
    },
  }),
}))

describe('StrokeNode', () => {
  beforeEach(() => {
    strokeEngine = createCanvasEngine()
    strokeNodeMocks.localOverlayState.eraseErasingStrokeIds = new Set<string>()
    strokeNodeMocks.localOverlayStore.subscribe.mockClear()
    strokeNodeMocks.registerStrokeNodePaths.mockReset()
    strokeNodeMocks.registerStrokeNodePaths.mockImplementation(() => vi.fn())
    strokeNodeMocks.resizableNodeWrapper.mockClear()
  })

  afterEach(() => {
    strokeEngine.destroy()
  })

  it('renders the local stroke highlight for pending-selected strokes', () => {
    const props = setupStrokeNodeProps({ selected: false })
    strokeEngine.setSelectionGesturePreview({
      nodeIds: new Set(['stroke-1']),
      edgeIds: new Set(),
    })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-detail-path')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-highlight-path')).toBeInTheDocument()
  })

  it('uses the uniform small canvas node resize minimum', () => {
    renderStroke(<StrokeNode {...setupStrokeNodeProps({ selected: false })} />)

    expect(strokeNodeMocks.resizableNodeWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        minHeight: CANVAS_NODE_MIN_SIZE,
        minWidth: CANVAS_NODE_MIN_SIZE,
        nodeType: 'stroke',
      }),
    )
  })

  it('drops the local stroke highlight when a pending preview excludes the committed stroke', () => {
    const props = setupStrokeNodeProps({ selected: true })
    strokeEngine.setSelectionGesturePreview({
      nodeIds: new Set(['other-node']),
      edgeIds: new Set(),
    })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-detail-path')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-highlight-path')).not.toBeInTheDocument()
  })

  it('keeps the detail path when a pending preview excludes an unselected stroke', () => {
    const props = setupStrokeNodeProps({ selected: false })
    strokeEngine.setSelectionGesturePreview({ nodeIds: new Set(), edgeIds: new Set() })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-detail-path')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-highlight-path')).not.toBeInTheDocument()
  })

  it('keeps the highlight path when a pending preview includes an already selected stroke', () => {
    const props = setupStrokeNodeProps({ selected: true })
    strokeEngine.setSelectionGesturePreview({
      nodeIds: new Set(['stroke-1']),
      edgeIds: new Set(),
    })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-detail-path')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-highlight-path')).toBeInTheDocument()
  })

  it('does not render edge creation handles for strokes', () => {
    const { container } = renderStroke(
      <StrokeNode {...setupStrokeNodeProps({ selected: false })} />,
    )

    expect(container.querySelector('[data-canvas-node-handle="true"]')).not.toBeInTheDocument()
  })

  it('still renders a visible stroke path when legacy stroke data has size zero', () => {
    const { container, getByTestId } = renderStroke(
      <StrokeNode {...setupStrokeNodeProps({ selected: false, size: 0 })} />,
    )

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelector('.canvas-stroke-detail-path')).toBeInTheDocument()
  })

  it('falls back to stroke bounds for invalid measured hit-target dimensions', () => {
    const { getByTestId } = renderStroke(
      <StrokeNode
        {...setupStrokeNodeProps({
          selected: false,
          width: 0,
          height: Number.NaN,
        })}
      />,
    )

    const hitTargetLayer = getByTestId('stroke-hit-target').closest('svg')
    expect(hitTargetLayer).toHaveAttribute('width', '124')
    expect(hitTargetLayer).toHaveAttribute('height', '44')
  })

  it('renders detail and highlight paths inside one stable svg coordinate frame', () => {
    const props = setupStrokeNodeProps({ selected: true })
    const { container } = renderStroke(<StrokeNode {...props} />)

    const svg = container.querySelector('.canvas-stroke-visual')
    expect(svg).toBeInTheDocument()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 20')
    const detailPath = svg?.querySelector('.canvas-stroke-detail-path')
    const highlightPath = svg?.querySelector('.canvas-stroke-highlight-path')
    expect(detailPath).toBeInTheDocument()
    expect(highlightPath).toBeInTheDocument()
    expect(
      highlightPath!.compareDocumentPosition(detailPath!) &
        globalThis.Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(highlightPath).toHaveAttribute(
      'd',
      getCachedStrokeDetailPath('stroke-1', props.data, 16),
    )
  })

  it('applies the screen-pixel minimum at low zoom without mutating authored size', () => {
    strokeEngine.setViewportLive({ x: 0, y: 0, zoom: 0.3 })
    const props = setupStrokeNodeProps({ selected: false, size: 1 })
    const { container } = renderStroke(<StrokeNode {...props} />)

    const detailPath = container.querySelector('.canvas-stroke-detail-path')
    expect(detailPath).toHaveAttribute(
      'd',
      getCachedStrokeDetailPath(props.id, props.data, 1 / 0.3),
    )
    expect(props.data.size).toBe(1)
    expect(strokeNodeMocks.registerStrokeNodePaths).toHaveBeenCalledWith(
      props.id,
      expect.objectContaining({ data: props.data }),
    )
  })

  it('updates rendered stroke paths when viewport zoom changes', () => {
    const props = setupStrokeNodeProps({ selected: false, size: 1 })
    const { container } = renderStroke(<StrokeNode {...props} />)

    const detailPath = container.querySelector('.canvas-stroke-detail-path')
    expect(detailPath).toHaveAttribute('d', getCachedStrokeDetailPath(props.id, props.data, 1))

    act(() => {
      strokeEngine.setViewportLive({ x: 0, y: 0, zoom: 0.25 })
    })

    expect(detailPath).toHaveAttribute('d', getCachedStrokeDetailPath(props.id, props.data, 4))
  })

  it('keeps registered stroke path refs stable across ordinary rerenders', () => {
    const unregisterStrokePaths = vi.fn()
    strokeNodeMocks.registerStrokeNodePaths.mockReturnValue(unregisterStrokePaths)
    const props = setupStrokeNodeProps({ selected: false })
    const { rerender } = render(
      <CanvasEngineProvider engine={strokeEngine}>
        <StrokeNode {...props} />
      </CanvasEngineProvider>,
    )

    rerender(
      <CanvasEngineProvider engine={strokeEngine}>
        <StrokeNode {...props} />
      </CanvasEngineProvider>,
    )

    expect(strokeNodeMocks.registerStrokeNodePaths).toHaveBeenCalledTimes(1)
    expect(unregisterStrokePaths).not.toHaveBeenCalled()
  })
})

function setupStrokeNodeProps({
  height = 20,
  selected,
  size = 4,
  width = 100,
}: {
  height?: number
  selected: boolean
  size?: number
  width?: number
}) {
  strokeEngine.setSelection({
    nodeIds: selected ? new Set(['stroke-1']) : new Set<string>(),
    edgeIds: new Set<string>(),
  })

  return {
    id: 'stroke-1',
    selected,
    dragging: false,
    width,
    height,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    isConnectable: false,
    draggable: true,
    selectable: true,
    deletable: true,
    zIndex: 1,
    type: 'stroke' as const,
    data: {
      bounds: { x: 0, y: 0, width: 100, height: 20 },
      points: [
        [0, 10, 0.5],
        [100, 10, 0.5],
      ] as Array<[number, number, number]>,
      color: 'var(--foreground)',
      size,
    },
  }
}

function renderStroke(ui: React.ReactElement) {
  return render(
    <CanvasEngineProvider engine={strokeEngine}>
      <CanvasRenderModeContext.Provider value="interactive">{ui}</CanvasRenderModeContext.Provider>
    </CanvasEngineProvider>,
  )
}
