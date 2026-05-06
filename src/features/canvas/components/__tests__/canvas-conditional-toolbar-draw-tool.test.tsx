import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasConditionalToolbar } from '../canvas-conditional-toolbar'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'

vi.mock('~/shared/components/color-picker-popover', () => ({
  ColorPickerPopover: () => <div data-testid="color-picker-popover" />,
}))

function renderToolbar() {
  const runtime = createCanvasRuntime({
    nodeActions: {
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
    history: {
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
    },
  })

  return render(
    <CanvasEngineProvider engine={runtime.canvasEngine}>
      <CanvasRuntimeProvider {...runtime}>
        <CanvasConditionalToolbar canEdit />
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )
}

describe('CanvasConditionalToolbar draw tool', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    useCanvasToolStore.getState().setActiveTool('draw')
  })

  it('updates the active draw color immediately after a preset click', () => {
    renderToolbar()

    const reversePrimaryButton = screen.getByRole('button', {
      name: 'Select Reverse primary color',
    })
    const redButton = screen.getByRole('button', { name: 'Select Red color' })

    expect(reversePrimaryButton).toHaveAttribute('aria-pressed', 'true')
    expect(redButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(redButton)

    expect(redButton).toHaveAttribute('aria-pressed', 'true')
    expect(reversePrimaryButton).toHaveAttribute('aria-pressed', 'false')
    expect(useCanvasToolStore.getState().strokeColor).toBe('var(--t-red)')
  })
})
