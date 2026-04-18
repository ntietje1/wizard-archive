import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasConditionalToolbar } from '../canvas-conditional-toolbar'
import { CanvasProviders } from '../../hooks/useCanvasContext'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { Node } from '@xyflow/react'

const selectionMock = vi.hoisted(() => ({
  onChange: null as ((params: { nodes: Array<Node> }) => void) | null,
}))

vi.mock('@xyflow/react', () => ({
  useOnSelectionChange: ({ onChange }: { onChange: (params: { nodes: Array<Node> }) => void }) => {
    selectionMock.onChange = onChange
  },
}))

vi.mock('~/shared/components/color-picker-popover', () => ({
  ColorPickerPopover: () => <div data-testid="color-picker-popover" />,
}))

function emitSelection(nodes: Array<Node>) {
  act(() => {
    selectionMock.onChange?.({ nodes })
  })
}

function renderToolbar() {
  return render(
    <CanvasProviders
      runtime={{
        nodeActions: {
          updateNodeData: vi.fn(),
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
        user: { name: 'Tester', color: '#fff' },
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
}

let nodeIdCounter = 0

function createNode(type: string, color?: string): Node {
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
    data: color ? { color, opacity: 75 } : {},
  }
}

describe('CanvasConditionalToolbar', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    selectionMock.onChange = null
    nodeIdCounter = 0
  })

  it('shows draw controls with stroke sizes when nothing is selected', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Stroke size 2' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Stroke size 16' })).toBeVisible()
  })

  it('shows rectangle controls without stroke sizes when nothing is selected', () => {
    useCanvasToolStore.getState().setActiveTool('rectangle')

    renderToolbar()
    emitSelection([])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stroke size 2' })).toBeNull()
  })

  it('shows single-selection controls for color-editable nodes only', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([createNode('sticky', 'var(--foreground)')])

    expect(screen.getByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stroke size 2' })).toBeNull()

    emitSelection([createNode('text')])
    expect(screen.queryByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeNull()
  })

  it('hides the toolbar for multi-select', () => {
    useCanvasToolStore.getState().setActiveTool('draw')

    renderToolbar()
    emitSelection([
      createNode('sticky', 'var(--foreground)'),
      createNode('rectangle', 'var(--foreground)'),
    ])

    expect(screen.queryByRole('toolbar', { name: 'Canvas conditional toolbar' })).toBeNull()
  })
})
