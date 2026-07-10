import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CanvasNodeFrame } from '../canvas-node-frame'

const frameState = vi.hoisted(() => ({
  dragging: false,
  hasMultipleSelectedNodes: false,
  interactive: true,
  pendingPreviewActive: false,
  pendingSelected: false,
  remoteHighlight: null as { color: string } | null,
  selected: false,
  visuallySelected: false,
  zoom: 2,
}))

vi.mock('../use-canvas-node-visual-selection', () => ({
  useCanvasNodeVisualSelection: () => ({
    pendingPreviewActive: frameState.pendingPreviewActive,
    pendingSelected: frameState.pendingSelected,
    selected: frameState.selected,
    visuallySelected: frameState.visuallySelected,
  }),
}))

vi.mock('../../../runtime/providers/use-canvas-render-mode', () => ({
  useIsInteractiveCanvasRenderMode: () => frameState.interactive,
}))

vi.mock('../../../runtime/providers/canvas-runtime', () => ({
  useCanvasCollaborationRuntime: () => ({
    remoteNodeHighlights: new Map(
      frameState.remoteHighlight ? [['node-1', frameState.remoteHighlight]] : [],
    ),
    remoteEdgeHighlights: new Map(),
  }),
}))

vi.mock('../../../react/use-canvas-engine', () => ({
  useCanvasEngineSelector: () => frameState.hasMultipleSelectedNodes,
}))

vi.mock('../../../components/canvas-screen-space-overlay-utils', () => ({
  CANVAS_SELECTION_CHROME_OUTSET_PX: 4,
  CANVAS_SELECTION_CHROME_STROKE: 'var(--selection)',
  CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX: 2,
  useCanvasScreenSpaceViewport: () => ({ zoom: frameState.zoom }),
}))

describe('CanvasNodeFrame', () => {
  beforeEach(() => {
    frameState.dragging = false
    frameState.hasMultipleSelectedNodes = false
    frameState.interactive = true
    frameState.pendingPreviewActive = false
    frameState.pendingSelected = false
    frameState.remoteHighlight = null
    frameState.selected = false
    frameState.visuallySelected = false
    frameState.zoom = 2
  })

  it('renders remote highlight chrome over local selection indicators', () => {
    frameState.interactive = true
    frameState.remoteHighlight = { color: 'rgb(1, 2, 3)' }
    frameState.visuallySelected = true
    frameState.pendingPreviewActive = true

    renderFrame()

    expect(screen.getByTestId('selection-border')).toHaveStyle({
      borderColor: 'rgb(1, 2, 3)',
      borderWidth: '1px',
      inset: '-2px',
    })
    expect(screen.queryByTestId('canvas-node-selection-indicator')).toBeNull()
  })

  it('shows local selection indicators for pending previews and multi-selection', () => {
    frameState.interactive = true
    frameState.remoteHighlight = null
    frameState.visuallySelected = true
    frameState.pendingPreviewActive = true
    frameState.hasMultipleSelectedNodes = true

    renderFrame()

    expect(screen.getByTestId('canvas-node-selection-indicator')).toBeInTheDocument()
    expect(screen.queryByTestId('selection-border')).toBeNull()
  })

  it('shows local selection indicators while dragging a visually selected node', () => {
    frameState.dragging = true
    frameState.interactive = true
    frameState.remoteHighlight = null
    frameState.visuallySelected = true
    frameState.pendingPreviewActive = false
    frameState.hasMultipleSelectedNodes = false

    renderFrame()

    expect(screen.getByTestId('canvas-node-selection-indicator')).toBeInTheDocument()
    expect(screen.queryByTestId('selection-border')).toBeNull()
  })

  it('suppresses selection chrome outside interactive render mode', () => {
    frameState.interactive = false
    frameState.remoteHighlight = { color: 'rgb(1, 2, 3)' }
    frameState.visuallySelected = true
    frameState.pendingPreviewActive = true
    frameState.hasMultipleSelectedNodes = true

    renderFrame()

    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryByTestId('canvas-node-selection-indicator')).toBeNull()
  })
})

function renderFrame() {
  return render(
    <CanvasNodeFrame id="node-1" nodeType="text" dragging={frameState.dragging}>
      <div data-testid="node-content" />
    </CanvasNodeFrame>,
  )
}
