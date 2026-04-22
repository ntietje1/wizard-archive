import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasToolbar } from '../canvas-toolbar'
import { createCanvasProviderProps } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasProviders } from '../../runtime/providers/canvas-runtime-context'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'

const reactFlowMock = vi.hoisted(() => ({
  fitView: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => reactFlowMock,
}))

describe('CanvasToolbar', () => {
  const history = {
    canUndo: false,
    canRedo: true,
    undo: vi.fn(),
    redo: vi.fn(),
  }

  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    reactFlowMock.fitView.mockReset()
    reactFlowMock.zoomIn.mockReset()
    reactFlowMock.zoomOut.mockReset()
    history.canUndo = false
    history.canRedo = true
    history.undo = vi.fn()
    history.redo = vi.fn()
  })

  function renderToolbar(canEdit = true) {
    const providerProps = createCanvasProviderProps({
      canEdit,
      history,
      editSession: {
        editingEmbedId: null,
        setEditingEmbedId: vi.fn(),
        pendingEditNodeId: null,
        pendingEditNodePoint: null,
        setPendingEditNodeId: vi.fn(),
        setPendingEditNodePoint: vi.fn(),
      },
      nodeActions: {
        updateNodeData: vi.fn(),
        onResize: vi.fn(),
        onResizeEnd: vi.fn(),
      },
    })

    return render(
      <CanvasProviders {...providerProps}>
        <CanvasToolbar canEdit={canEdit} />
      </CanvasProviders>,
    )
  }

  it('renders the requested main toolbar order', () => {
    renderToolbar()

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas main toolbar' })
    const buttons = within(toolbar).getAllByRole('button')
    const labels = buttons.map((button) => button.getAttribute('aria-label'))

    expect(labels).toEqual(['Pointer', 'Panning', 'Lasso select', 'Draw', 'Eraser', 'Text'])
    expect(buttons.map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(buttons.map((button) => button.getAttribute('title'))).toEqual([
      'Pointer (1)',
      'Panning (2)',
      'Lasso select (3)',
      'Draw (4)',
      'Eraser (5)',
      'Text (6)',
    ])
  })

  it('renders top-right controls in the requested order', () => {
    renderToolbar()

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas viewport controls' })
    const buttons = within(toolbar).getAllByRole('button')

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit zoom',
      'Undo',
      'Redo',
    ])
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled()
  })

  it('shows only viewport controls in read-only mode', () => {
    renderToolbar(false)

    expect(screen.queryByRole('toolbar', { name: 'Canvas main toolbar' })).not.toBeInTheDocument()

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas viewport controls' })
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Zoom in', 'Zoom out', 'Fit zoom'])
  })
})
