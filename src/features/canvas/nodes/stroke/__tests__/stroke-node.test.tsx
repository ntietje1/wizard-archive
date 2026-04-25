import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasEngineProvider } from '../../../react/canvas-engine-context'
import { createCanvasEngine } from '../../../system/canvas-engine'
import type { CanvasEngine } from '../../../system/canvas-engine'
import { StrokeNode } from '../stroke-node'

const connectionHandlesSpy = vi.hoisted(() => vi.fn())
let strokeEngine: CanvasEngine = createCanvasEngine()

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ zoom: 1 }),
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
}))

vi.mock('../../shared/resizable-node-wrapper', () => ({
  ResizableNodeWrapper: ({ children, chrome }: { children: ReactNode; chrome?: ReactNode }) => (
    <div>
      {chrome}
      {children}
    </div>
  ),
}))

vi.mock('../../shared/canvas-node-connection-handles', () => ({
  CanvasNodeConnectionHandles: (props: unknown) => {
    connectionHandlesSpy(props)
    return <div data-testid="stroke-connection-handles" />
  },
}))

vi.mock('../../../runtime/providers/canvas-runtime', () => ({
  useCanvasRuntime: () => ({
    canvasEngine: {
      registerStrokeNodePaths: vi.fn(() => vi.fn()),
    },
  }),
}))

afterEach(() => {
  strokeEngine = createCanvasEngine()
  connectionHandlesSpy.mockReset()
})

describe('StrokeNode', () => {
  it('renders the local stroke highlight for pending-selected strokes', () => {
    const props = setupStrokeNodeProps({ selected: false })
    strokeEngine.setSelectionGesturePreview({
      nodeIds: new Set(['stroke-1']),
      edgeIds: new Set(),
    })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(3)
  })

  it('drops the local stroke highlight when a pending preview excludes the committed stroke', () => {
    const props = setupStrokeNodeProps({ selected: true })
    strokeEngine.setSelectionGesturePreview({
      nodeIds: new Set(['other-node']),
      edgeIds: new Set(),
    })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('keeps two paths (stroke and hit target) when a pending preview excludes an unselected stroke', () => {
    const props = setupStrokeNodeProps({ selected: false })
    strokeEngine.setSelectionGesturePreview({ nodeIds: new Set(), edgeIds: new Set() })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(2)
  })

  it('keeps the highlight path when a pending preview includes an already selected stroke', () => {
    const props = setupStrokeNodeProps({ selected: true })
    strokeEngine.setSelectionGesturePreview({
      nodeIds: new Set(['stroke-1']),
      edgeIds: new Set(),
    })
    const { container, getByTestId } = renderStroke(<StrokeNode {...props} />)

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(3)
  })

  it('passes only start and end connection handles at the stroke endpoints', () => {
    renderStroke(<StrokeNode {...setupStrokeNodeProps({ selected: false })} />)

    expect(connectionHandlesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        handles: [
          expect.objectContaining({
            id: 'start',
            position: 'left',
            style: expect.objectContaining({ left: 0, top: 10 }),
          }),
          expect.objectContaining({
            id: 'end',
            position: 'right',
            style: expect.objectContaining({ left: 100, top: 10 }),
          }),
        ],
      }),
    )
  })

  it('still renders a visible stroke path when legacy stroke data has size zero', () => {
    const { container, getByTestId } = renderStroke(
      <StrokeNode {...setupStrokeNodeProps({ selected: false, size: 0 })} />,
    )

    expect(getByTestId('stroke-hit-target')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(2)
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
    type: 'stroke',
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
