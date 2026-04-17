import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasToolbar } from '../canvas-toolbar'
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
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    useCanvasToolStore.getState().setHistory({
      canUndo: false,
      canRedo: true,
      undo: vi.fn(),
      redo: vi.fn(),
    })
  })

  it('renders the requested main toolbar order', () => {
    render(<CanvasToolbar canEdit />)

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas main toolbar' })
    const labels = within(toolbar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))

    expect(labels).toEqual([
      'Pointer',
      'Panning',
      'Lasso select',
      'Draw',
      'Eraser',
      'Text',
      'Post-it',
      'Rectangle',
    ])
  })

  it('renders top-right controls in the requested order', () => {
    render(<CanvasToolbar canEdit />)

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
    render(<CanvasToolbar canEdit={false} />)

    expect(screen.queryByRole('toolbar', { name: 'Canvas main toolbar' })).toBeNull()

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas viewport controls' })
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Zoom in', 'Zoom out', 'Fit zoom'])
  })
})
