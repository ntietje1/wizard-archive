import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasConditionalToolbar } from '../canvas-conditional-toolbar'
import { CanvasProviders } from '../../runtime/providers/use-canvas-context'
import { useCanvasSelectionState } from '../../runtime/selection/use-canvas-selection-state'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { Node } from '@xyflow/react'

const nodesMock = vi.hoisted(() => ({
  nodes: [] as Array<Node>,
}))

const colorPickerMock = vi.hoisted(() => ({
  lastProps: null as null | Record<string, unknown>,
}))

vi.mock('@xyflow/react', () => ({
  useNodes: () => nodesMock.nodes,
}))

vi.mock('~/shared/components/color-picker-popover', () => ({
  ColorPickerPopover: (props: Record<string, unknown>) => {
    colorPickerMock.lastProps = props
    return <div data-testid="color-picker-popover" />
  },
}))

function emitSelection(nodes: Array<Node>) {
  act(() => {
    nodesMock.nodes = nodes
    useCanvasSelectionState.getState().setSelectedNodeIds(nodes.map((node) => node.id))
  })
}

function renderToolbar(updateNodeData = vi.fn()) {
  const view = render(
    <CanvasProviders
      runtime={{
        nodeActions: {
          updateNodeData,
          onResize: vi.fn(),
          onResizeEnd: vi.fn(),
        },
        editSession: {
          editingEmbedId: null,
          setEditingEmbedId: vi.fn(),
          pendingEditNodeId: null,
          setPendingEditNodeId: vi.fn(),
        },
        remoteHighlights: new Map(),
        canEdit: true,
        history: {
          canUndo: false,
          canRedo: false,
          undo: vi.fn(),
          redo: vi.fn(),
        },
      }}
    >
      <CanvasConditionalToolbar canEdit />
    </CanvasProviders>,
  )

  return {
    ...view,
    updateNodeData,
  }
}

let nodeIdCounter = 0

function createNode(
  type: string,
  options: {
    color?: string
    opacity?: number
  } = {},
): Node {
  return {
    id: `${type}-${nodeIdCounter++}`,
    type,
    position: { x: 0, y: 0 },
    selected: false,
    dragging: false,
    draggable: true,
    deletable: true,
    selectable: true,
    connectable: true,
    width: 100,
    height: 100,
    data: {
      ...(options.color !== undefined ? { color: options.color } : {}),
      ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
    },
  }
}

describe('CanvasConditionalToolbar', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    useCanvasSelectionState.getState().reset()
    nodesMock.nodes = []
    colorPickerMock.lastProps = null
    nodeIdCounter = 0
  })

  it('shows draw tool properties when nothing is selected', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Stroke size 2' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Stroke size 16' })).toBeVisible()
    expect(screen.getByTestId('color-picker-popover')).toBeVisible()
  })

  it('shows rectangle tool properties without stroke size when nothing is selected', () => {
    useCanvasToolStore.getState().setActiveTool('rectangle')

    renderToolbar()
    emitSelection([])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stroke size 2' })).toBeNull()
  })

  it('shows single-node properties for editable nodes only', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([createNode('sticky', { color: 'var(--foreground)', opacity: 75 })])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stroke size 2' })).toBeNull()

    emitSelection([createNode('text')])
    expect(screen.queryByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeNull()
  })

  it('shows shared properties for compatible multi-select and hides tool-only controls', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([
      createNode('sticky', { color: 'var(--foreground)', opacity: 75 }),
      createNode('rectangle', { color: 'var(--foreground)', opacity: 75 }),
    ])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stroke size 2' })).toBeNull()
  })

  it('fans out shared color updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const sticky = createNode('sticky', { color: 'var(--foreground)', opacity: 75 })
    const rectangle = createNode('rectangle', { color: 'var(--foreground)', opacity: 75 })
    emitSelection([sticky, rectangle])

    fireEvent.click(screen.getByRole('button', { name: 'Select Red color' }))

    expect(updateNodeData).toHaveBeenCalledWith(sticky.id, { color: 'var(--t-red)' })
    expect(updateNodeData).toHaveBeenCalledWith(rectangle.id, { color: 'var(--t-red)' })
  })

  it('fans out shared opacity updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const stroke = createNode('stroke', { color: 'var(--foreground)', opacity: 20 })
    const rectangle = createNode('rectangle', { color: 'var(--foreground)', opacity: 20 })
    emitSelection([stroke, rectangle])

    act(() => {
      ;(colorPickerMock.lastProps?.onOpacityChange as ((opacity: number) => void) | undefined)?.(42)
    })

    expect(updateNodeData).toHaveBeenCalledWith(stroke.id, { opacity: 42 })
    expect(updateNodeData).toHaveBeenCalledWith(rectangle.id, { opacity: 42 })
  })

  it('renders mixed state for shared properties with different values', () => {
    renderToolbar()

    emitSelection([
      createNode('sticky', { color: 'var(--foreground)', opacity: 30 }),
      createNode('rectangle', { color: 'var(--t-red)', opacity: 90 }),
    ])

    expect(screen.getByRole('button', { name: 'Select Default color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Select Red color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(colorPickerMock.lastProps?.colorMixed).toBe(true)
    expect(colorPickerMock.lastProps?.opacityMixed).toBe(true)
  })

  it('hides the toolbar when the selection has no shared properties', () => {
    renderToolbar()

    emitSelection([createNode('text'), createNode('sticky', { color: 'var(--foreground)' })])

    expect(screen.queryByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeNull()
  })

  it('hides the toolbar while marquee selection is still provisional', () => {
    renderToolbar()

    act(() => {
      useCanvasSelectionState.getState().beginGesture('marquee')
    })
    emitSelection([createNode('stroke', { color: 'var(--foreground)', opacity: 75 })])

    expect(screen.queryByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeNull()

    act(() => {
      useCanvasSelectionState.getState().endGesture()
    })

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
  })
})
