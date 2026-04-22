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
  props: [] as Array<Record<string, unknown>>,
}))

vi.mock('@xyflow/react', () => ({
  useNodes: () => nodesMock.nodes,
}))

vi.mock('~/shared/components/color-picker-popover', () => ({
  ColorPickerPopover: (props: Record<string, unknown>) => {
    colorPickerMock.props.push(props)
    return <div data-testid="color-picker-popover" />
  },
}))

function emitSelection(nodes: Array<Node>) {
  act(() => {
    colorPickerMock.props = []
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
    backgroundOpacity?: number
    borderStroke?: string | null
    borderOpacity?: number
    borderWidth?: number
    sidebarItemId?: string
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
      ...(options.backgroundOpacity !== undefined
        ? { backgroundOpacity: options.backgroundOpacity }
        : {}),
      ...(options.borderStroke !== undefined ? { borderStroke: options.borderStroke } : {}),
      ...(options.borderOpacity !== undefined ? { borderOpacity: options.borderOpacity } : {}),
      ...(options.borderWidth !== undefined ? { borderWidth: options.borderWidth } : {}),
      ...(options.sidebarItemId !== undefined ? { sidebarItemId: options.sidebarItemId } : {}),
    },
  }
}

describe('CanvasConditionalToolbar', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    useCanvasSelectionState.getState().reset()
    nodesMock.nodes = []
    colorPickerMock.props = []
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
    expect(screen.getByRole('button', { name: 'Stroke size 1' })).toBeVisible()

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
    expect(screen.getByRole('button', { name: 'Stroke size 1' })).toBeVisible()
  })

  it('fans out shared color updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const firstText = createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null })
    const secondText = createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null })
    emitSelection([firstText, secondText])

    const fillGroup = screen.getByText('Fill').parentElement
    expect(fillGroup).not.toBeNull()

    fireEvent.click(within(fillGroup!).getByRole('button', { name: 'Select Red color' }))

    expect(updateNodeData).toHaveBeenCalledWith(firstText.id, { backgroundColor: 'var(--bg-red)' })
    expect(updateNodeData).toHaveBeenCalledWith(firstText.id, { backgroundOpacity: 100 })
    expect(updateNodeData).toHaveBeenCalledWith(secondText.id, { backgroundColor: 'var(--bg-red)' })
    expect(updateNodeData).toHaveBeenCalledWith(secondText.id, { backgroundOpacity: 100 })
  })

  it('supports clearing the selected border stroke by setting opacity to zero', () => {
    const { updateNodeData } = renderToolbar()

    const text = createNode('text', {
      backgroundColor: 'var(--background)',
      borderStroke: 'var(--border)',
      borderOpacity: 100,
    })
    emitSelection([text])

    const borderGroup = screen.getByText('Border').parentElement
    expect(borderGroup).not.toBeNull()

    fireEvent.click(within(borderGroup!).getByRole('button', { name: 'Select Clear color' }))

    expect(updateNodeData).toHaveBeenCalledWith(text.id, { borderOpacity: 0 })
  })

  it('fans out shared opacity updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const firstStroke = createNode('stroke', { color: 'var(--foreground)', opacity: 20 })
    const secondStroke = createNode('stroke', { color: 'var(--foreground)', opacity: 20 })
    emitSelection([firstStroke, secondStroke])

    act(() => {
      // props[0] is the stroke color picker for the selected stroke nodes.
      ;(
        colorPickerMock.props[0]?.onChange as
          | ((value: { color: string; opacity: number }) => void)
          | undefined
      )?.({
        color: 'var(--foreground)',
        opacity: 42,
      })
    })

    expect(updateNodeData).toHaveBeenCalledWith(firstStroke.id, { opacity: 42 })
    expect(updateNodeData).toHaveBeenCalledWith(secondStroke.id, { opacity: 42 })
  })

  it('fans out shared fill opacity updates to every selected node', () => {
    const { updateNodeData } = renderToolbar()

    const firstText = createNode('text', {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 40,
      borderStroke: 'var(--border)',
      borderOpacity: 100,
      borderWidth: 1,
    })
    const secondText = createNode('text', {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 40,
      borderStroke: 'var(--border)',
      borderOpacity: 100,
      borderWidth: 1,
    })
    emitSelection([firstText, secondText])

    act(() => {
      // props[0] is the fill color picker; border is rendered after fill.
      ;(
        colorPickerMock.props[0]?.onChange as
          | ((value: { color: string; opacity: number }) => void)
          | undefined
      )?.({
        color: 'var(--background)',
        opacity: 65,
      })
    })

    expect(updateNodeData).toHaveBeenCalledWith(firstText.id, { backgroundOpacity: 65 })
    expect(updateNodeData).toHaveBeenCalledWith(secondText.id, { backgroundOpacity: 65 })
  })

  it('shows the reverse primary swatch for fill and applies it to selected nodes', () => {
    const { updateNodeData } = renderToolbar()

    const text = createNode('text', {
      backgroundColor: 'var(--background)',
      backgroundOpacity: 100,
      borderStroke: 'var(--border)',
      borderOpacity: 100,
      borderWidth: 1,
    })
    emitSelection([text])

    const fillGroup = screen.getByText('Fill').parentElement
    expect(fillGroup).not.toBeNull()

    fireEvent.click(
      within(fillGroup!).getByRole('button', { name: 'Select Reverse primary color' }),
    )

    expect(updateNodeData).toHaveBeenCalledWith(text.id, { backgroundColor: 'var(--foreground)' })
    expect(updateNodeData).toHaveBeenCalledWith(text.id, { backgroundOpacity: 100 })
  })

  it('does not show a default border preset', () => {
    renderToolbar()

    emitSelection([
      createNode('text', {
        backgroundColor: 'var(--background)',
        backgroundOpacity: 100,
        borderStroke: 'var(--border)',
        borderOpacity: 100,
        borderWidth: 1,
      }),
    ])

    const borderGroup = screen.getByText('Border').parentElement
    expect(borderGroup).not.toBeNull()

    expect(within(borderGroup!).queryByRole('button', { name: 'Select Default color' })).toBeNull()
  })

  it('shows fill, border, and stroke size controls for embed nodes', () => {
    renderToolbar()

    emitSelection([
      createNode('embed', {
        sidebarItemId: 'sidebar-item-1',
        backgroundColor: 'var(--background)',
        backgroundOpacity: 100,
        borderStroke: 'var(--border)',
        borderOpacity: 100,
        borderWidth: 1,
      }),
    ])

    expect(screen.getByText('Fill')).toBeVisible()
    expect(screen.getByText('Border')).toBeVisible()
    expect(screen.getByText('Stroke size')).toBeVisible()
  })

  it('renders mixed state for shared properties with different values', () => {
    renderToolbar()

    emitSelection([
      createNode('text', { backgroundColor: '#FFEBA1', borderStroke: null }),
      createNode('text', { backgroundColor: 'var(--bg-red)', borderStroke: null }),
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

  it('does not treat an opacity-zero custom color as the clear preset', () => {
    useCanvasToolStore.getState().setActiveTool('draw')
    renderToolbar()

    act(() => {
      useCanvasToolStore.getState().setStrokeColor('var(--t-red)')
      useCanvasToolStore.getState().setStrokeOpacity(0)
    })
    emitSelection([])

    const strokeGroup = screen.getByText('Stroke').parentElement
    expect(strokeGroup).not.toBeNull()

    expect(
      within(strokeGroup!).getByRole('button', { name: 'Select Clear color' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(within(strokeGroup!).getByRole('button', { name: 'Select Red color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('selecting clear then a color unselects the clear preset', () => {
    useCanvasToolStore.getState().setActiveTool('draw')
    renderToolbar()
    emitSelection([])

    const strokeGroup = screen.getByText('Stroke').parentElement
    expect(strokeGroup).not.toBeNull()

    const clearButton = within(strokeGroup!).getByRole('button', { name: 'Select Clear color' })
    const redButton = within(strokeGroup!).getByRole('button', { name: 'Select Red color' })

    fireEvent.click(clearButton)
    expect(clearButton).toHaveAttribute('aria-pressed', 'true')
    expect(redButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(redButton)
    expect(clearButton).toHaveAttribute('aria-pressed', 'false')
    expect(redButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows only the shared stroke size control when a mixed selection has no shared paint properties', () => {
    renderToolbar()

    emitSelection([
      createNode('text', { backgroundColor: 'var(--background)', borderStroke: 'var(--border)' }),
      createNode('stroke', { color: 'var(--foreground)' }),
    ])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.getByText('Stroke size')).toBeVisible()
    expect(screen.queryByText('Fill')).toBeNull()
    expect(screen.queryByText('Border')).toBeNull()
    expect(screen.queryByText('Stroke')).toBeNull()
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
