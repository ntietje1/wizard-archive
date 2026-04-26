import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasToolbar } from '../canvas-toolbar'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime-context'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'

const viewportActionMock = vi.hoisted(() => ({
  fitView: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
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
    viewportActionMock.fitView.mockReset()
    viewportActionMock.zoomIn.mockReset()
    viewportActionMock.zoomOut.mockReset()
    history.canUndo = false
    history.canRedo = true
    history.undo = vi.fn()
    history.redo = vi.fn()
  })

  function renderToolbar(canEdit = true) {
    const viewportController: CanvasViewportController = {
      getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      getZoom: vi.fn(() => 1),
      screenToCanvasPosition: vi.fn((position) => position),
      canvasToScreenPosition: vi.fn((position) => position),
      handleWheel: vi.fn(),
      handlePanPointerDown: vi.fn(),
      panBy: vi.fn(),
      zoomBy: vi.fn(),
      zoomTo: vi.fn(),
      zoomIn: viewportActionMock.zoomIn,
      zoomOut: viewportActionMock.zoomOut,
      fitView: viewportActionMock.fitView,
      syncFromDocumentOrAdapter: vi.fn(),
      commit: vi.fn(),
      destroy: vi.fn(),
    }
    const runtime = createCanvasRuntime({
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
        onResize: vi.fn(),
        onResizeEnd: vi.fn(),
      },
      viewportController,
    })

    return render(
      <CanvasRuntimeProvider {...runtime}>
        <CanvasToolbar canEdit={canEdit} />
      </CanvasRuntimeProvider>,
    )
  }

  it('renders the requested main toolbar order', () => {
    renderToolbar()

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas main toolbar' })
    const buttons = within(toolbar).getAllByRole('button')
    const labels = buttons.map((button) => button.getAttribute('aria-label'))

    expect(labels).toEqual([
      'Pointer',
      'Panning',
      'Lasso select',
      'Draw',
      'Eraser',
      'Text',
      'Edges',
    ])
    expect(buttons.map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(buttons.map((button) => button.getAttribute('title'))).toEqual([
      'Pointer (1)',
      'Panning (2)',
      'Lasso select (3)',
      'Draw (4)',
      'Eraser (5)',
      'Text (6)',
      'Edges (7)',
    ])
    expect(toolbar).toHaveClass('cursor-default')
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
    expect(toolbar).toHaveClass('cursor-default')
    buttons.forEach((button) => {
      expect(button).toHaveClass('cursor-pointer')
    })
  })

  it('routes viewport buttons through the canvas viewport controller', () => {
    renderToolbar()

    screen.getByRole('button', { name: 'Zoom in' }).click()
    screen.getByRole('button', { name: 'Zoom out' }).click()
    screen.getByRole('button', { name: 'Fit zoom' }).click()

    expect(viewportActionMock.zoomIn).toHaveBeenCalledTimes(1)
    expect(viewportActionMock.zoomOut).toHaveBeenCalledTimes(1)
    expect(viewportActionMock.fitView).toHaveBeenCalledTimes(1)
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
