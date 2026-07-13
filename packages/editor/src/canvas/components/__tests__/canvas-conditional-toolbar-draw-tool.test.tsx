import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CanvasConditionalToolbar } from '../canvas-conditional-toolbar'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasRuntime } from '../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../runtime/providers/canvas-runtime'
import { createCanvasToolStore } from '../../stores/canvas-tool-store'

const canvasToolStore = createCanvasToolStore()

vi.mock('@wizard-archive/ui/components/color-picker-popover', () => ({
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
      pendingEdit: null,
      setPendingEdit: vi.fn(),
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
      <CanvasRuntimeProvider {...runtime} toolStore={canvasToolStore}>
        <CanvasConditionalToolbar canEdit />
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>,
  )
}

describe('CanvasConditionalToolbar draw tool', () => {
  beforeEach(() => {
    canvasToolStore.getState().reset()
    canvasToolStore.getState().setActiveTool('draw')
  })

  afterEach(() => {
    document.documentElement.style.removeProperty('--background')
    document.documentElement.style.removeProperty('--border')
    document.documentElement.style.removeProperty('--foreground')
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
    expect(canvasToolStore.getState().strokeColor).toBe('var(--t-red)')
  })

  it('selects only the active theme-token stroke swatch when theme variables resolve through oklch', () => {
    document.documentElement.style.setProperty('--background', 'oklch(0.14 0.01 303)')
    document.documentElement.style.setProperty('--border', 'oklch(0.49 0.02 288.86)')
    document.documentElement.style.setProperty('--foreground', 'oklch(0.95 0.01416 303.899)')

    renderToolbar()

    expect(screen.getByRole('button', { name: 'Select Primary color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Select Border color' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Select Reverse primary color' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
