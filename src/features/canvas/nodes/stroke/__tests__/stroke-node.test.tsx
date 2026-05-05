import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { CanvasEngine } from '../../../system/canvas-engine'
import { getCachedStrokeDetailPath } from '../stroke-path-cache'
import { StrokeNode } from '../stroke-node'

let strokeEngine!: CanvasEngine
const strokeNodeMocks = vi.hoisted(() => ({
  registerStrokeNodePaths: vi.fn(() => vi.fn()),
  zoom: 1,
}))

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: ({ children, chrome }: { children: ReactNode; chrome?: ReactNode }) => (
    <div>
      {chrome}
      {children}
    </div>
  ),
}))

vi.mock('../../../runtime/providers/canvas-runtime', () => ({
  useCanvasViewportRuntime: () => ({
    domRuntime: {
      registerStrokeNodePaths: strokeNodeMocks.registerStrokeNodePaths,
    },
    viewportController: {
      getZoom: () => strokeNodeMocks.zoom,
    },
  }),
}))

describe('StrokeNode', () => {
  beforeEach(() => {
    strokeEngine = createCanvasEngine()
    strokeNodeMocks.registerStrokeNodePaths.mockClear()
    strokeNodeMocks.zoom = 1
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

  it('renders detail and highlight paths inside one stable svg coordinate frame', () => {
    const { container } = renderStroke(<StrokeNode {...setupStrokeNodeProps({ selected: true })} />)

    const svg = container.querySelector('.canvas-stroke-visual')
    expect(svg).toBeInTheDocument()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 20')
    expect(svg?.querySelector('.canvas-stroke-detail-path')).toBeInTheDocument()
    expect(svg?.querySelector('.canvas-stroke-highlight-path')).toBeInTheDocument()
  })

  it('applies the screen-pixel minimum at low zoom without mutating authored size', () => {
    strokeNodeMocks.zoom = 0.3
    const props = setupStrokeNodeProps({ selected: false, size: 1 })
    const { container } = renderStroke(<StrokeNode {...props} />)

    const detailPath = container.querySelector('.canvas-stroke-detail-path')
    expect(detailPath).toHaveAttribute(
      'd',
      getCachedStrokeDetailPath(props.id, props.data, 1 / strokeNodeMocks.zoom),
    )
    expect(props.data.size).toBe(1)
    expect(strokeNodeMocks.registerStrokeNodePaths).toHaveBeenCalledWith(
      props.id,
      expect.objectContaining({ data: props.data }),
    )
  })
})

function setupStrokeNodeProps({ selected, size = 4 }: { selected: boolean; size?: number }) {
  strokeEngine.setSelection({
    nodeIds: selected ? new Set(['stroke-1']) : new Set<string>(),
    edgeIds: new Set<string>(),
  })

  return {
    id: 'stroke-1',
    selected,
    dragging: false,
    width: 100,
    height: 20,
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
  return render(<CanvasEngineProvider engine={strokeEngine}>{ui}</CanvasEngineProvider>)
}
