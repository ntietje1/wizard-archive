import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CanvasNodeConnectionHandles } from '../canvas-node-connection-handles'
import { CanvasRenderModeContext } from '../../../runtime/providers/canvas-render-mode-context'
import { createCanvasRuntime } from '../../../runtime/__tests__/canvas-runtime-test-utils'
import { CanvasRuntimeProvider } from '../../../runtime/providers/canvas-runtime'
import { createCanvasToolStore } from '../../../stores/canvas-tool-store'

const canvasToolStore = createCanvasToolStore()

function renderHandles(renderMode: 'interactive' | 'embedded-readonly' = 'interactive') {
  return render(
    <CanvasRuntimeProvider {...createCanvasRuntime()} toolStore={canvasToolStore}>
      <CanvasRenderModeContext value={renderMode}>
        <CanvasNodeConnectionHandles />
      </CanvasRenderModeContext>
    </CanvasRuntimeProvider>,
  )
}

describe('CanvasNodeConnectionHandles', () => {
  beforeEach(() => {
    canvasToolStore.getState().reset()
  })

  it('keeps handles mounted but inert when the edge tool is inactive', () => {
    renderHandles()

    expect(screen.getAllByTestId(/canvas-node-handle-/)).toHaveLength(4)
    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute(
      'data-handles-visible',
      'false',
    )
  })

  it('marks handles visible while the edge tool is active', () => {
    canvasToolStore.getState().setActiveTool('edge')

    renderHandles()

    expect(screen.getByTestId('canvas-node-handle-top')).toHaveAttribute(
      'data-handles-visible',
      'true',
    )
  })

  it('does not render handles in non-interactive render mode', () => {
    canvasToolStore.getState().setActiveTool('edge')

    renderHandles('embedded-readonly')

    expect(screen.queryByTestId('canvas-node-handle-top')).toBeNull()
  })
})
