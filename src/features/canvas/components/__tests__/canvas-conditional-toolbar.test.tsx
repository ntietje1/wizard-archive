import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasConditionalToolbar } from '../canvas-conditional-toolbar'
import { CanvasProviders } from '../../runtime/providers/canvas-runtime-context'
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
    useCanvasSelectionState.getState().setSelection({
      nodeIds: nodes.map((node) => node.id),
      edgeIds: [],
    })
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
          pendingEditNodePoint: null,
          setPendingEditNodeId: vi.fn(),
          setPendingEditNodePoint: vi.fn(),
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
    size?: number
    backgroundColor?: string | null
    borderStroke?: string | null
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
      ...(options.size !== undefined ? { size: options.size } : {}),
      ...(options.backgroundColor !== undefined
        ? { backgroundColor: options.backgroundColor }
        : {}),
      ...(options.borderStroke !== undefined ? { borderStroke: options.borderStroke } : {}),
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

  it('updates tool property button state after changing tool color and stroke size', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    const defaultColorButton = screen.getByRole('button', { name: 'Select Default color' })
    const redColorButton = screen.getByRole('button', { name: 'Select Red color' })
    const mediumStrokeButton = screen.getByRole('button', { name: 'Stroke size 4' })
    const largeStrokeButton = screen.getByRole('button', { name: 'Stroke size 8' })

    expect(defaultColorButton).toHaveAttribute('aria-pressed', 'true')
    expect(redColorButton).toHaveAttribute('aria-pressed', 'false')
    expect(mediumStrokeButton).toHaveAttribute('aria-pressed', 'true')
    expect(largeStrokeButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(redColorButton)
    fireEvent.click(largeStrokeButton)

    expect(defaultColorButton).toHaveAttribute('aria-pressed', 'false')
    expect(redColorButton).toHaveAttribute('aria-pressed', 'true')
    expect(mediumStrokeButton).toHaveAttribute('aria-pressed', 'false')
    expect(largeStrokeButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows single-node properties for editable nodes only', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([
      createNode('text', {
        backgroundColor: '#FFEBA1',
        borderStroke: null,
      }),
    ])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stroke size 2' })).toBeNull()

    emitSelection([
      createNode('text', {
        backgroundColor: 'var(--background)',
        borderStroke: 'var(--border)',
      }),
    ])
    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
  })

  it('shows stroke size controls for a selected stroke and updates the node size', () => {
    const { updateNodeData } = renderToolbar()

    const stroke = createNode('stroke', {
      color: 'var(--foreground)',
      opacity: 75,
      size: 4,
    })
    emitSelection([stroke])

    const mediumStrokeButton = screen.getByRole('button', { name: 'Stroke size 4' })
    const largeStrokeButton = screen.getByRole('button', { name: 'Stroke size 8' })

    expect(mediumStrokeButton).toHaveAttribute('aria-pressed', 'true')
    expect(largeStrokeButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(largeStrokeButton)

    expect(updateNodeData).toHaveBeenCalledWith(stroke.id, { size: 8 })
  })

  it('shows shared properties for compatible multi-select and hides tool-only controls', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([
      createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null }),
      createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null }),
    ])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stroke size 2' })).toBeNull()
  })

  it('fans out shared color updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const firstText = createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null })
    const secondText = createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null })
    emitSelection([firstText, secondText])

    const fillGroup = screen.getByText('Fill').parentElement
    expect(fillGroup).not.toBeNull()

    fireEvent.click(within(fillGroup!).getByRole('button', { name: 'Select Red color' }))

    expect(updateNodeData).toHaveBeenCalledWith(firstText.id, { backgroundColor: 'var(--t-red)' })
    expect(updateNodeData).toHaveBeenCalledWith(secondText.id, { backgroundColor: 'var(--t-red)' })
  })

  it('supports clearing the selected border stroke', () => {
    const { updateNodeData } = renderToolbar()

    const text = createNode('text', {
      backgroundColor: 'var(--background)',
      borderStroke: 'var(--border)',
    })
    emitSelection([text])

    fireEvent.click(screen.getByRole('button', { name: 'No stroke' }))

    expect(updateNodeData).toHaveBeenCalledWith(text.id, { borderStroke: null })
  })

  it('fans out shared opacity updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const firstStroke = createNode('stroke', { color: 'var(--foreground)', opacity: 20 })
    const secondStroke = createNode('stroke', { color: 'var(--foreground)', opacity: 20 })
    emitSelection([firstStroke, secondStroke])

    act(() => {
      ;(colorPickerMock.lastProps?.onOpacityChange as ((opacity: number) => void) | undefined)?.(42)
    })

    expect(updateNodeData).toHaveBeenCalledWith(firstStroke.id, { opacity: 42 })
    expect(updateNodeData).toHaveBeenCalledWith(secondStroke.id, { opacity: 42 })
  })

  it('renders mixed state for shared properties with different values', () => {
    renderToolbar()

    emitSelection([
      createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null }),
      createNode('text', { backgroundColor: 'var(--t-red)', borderStroke: null }),
    ])

    const fillGroup = screen.getByText('Fill').parentElement
    expect(fillGroup).not.toBeNull()

    expect(
      within(fillGroup!).getByRole('button', { name: 'Select Default color' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(within(fillGroup!).getByRole('button', { name: 'Select Red color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getAllByTestId('color-picker-popover')).toHaveLength(2)
  })

  it('hides the toolbar when the selection has no shared properties', () => {
    renderToolbar()

    emitSelection([
      createNode('text', { backgroundColor: 'var(--background)', borderStroke: 'var(--border)' }),
      createNode('stroke', { color: 'var(--foreground)' }),
    ])

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
