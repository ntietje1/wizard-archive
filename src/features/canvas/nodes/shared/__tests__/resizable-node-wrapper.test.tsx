import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasProviders } from '../../../runtime/providers/canvas-runtime-context'
import { useCanvasSelectionState } from '../../../runtime/selection/use-canvas-selection-state'
import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from '../../../runtime/selection/use-canvas-pending-selection-preview'
import { ResizableNodeWrapper } from '../resizable-node-wrapper'

vi.mock('@xyflow/react', () => ({
  NodeResizeControl: ({ children }: { children: ReactNode }) => (
    <div data-testid="resize-control">{children}</div>
  ),
}))

afterEach(() => {
  clearCanvasPendingSelectionPreview()
  useCanvasSelectionState.getState().reset()
})

describe('ResizableNodeWrapper', () => {
  it('renders the normal selection border for pending-only preview nodes without resize handles', () => {
    setCanvasPendingSelectionPreview({ nodeIds: ['node-1'], edgeIds: [] })
    renderWrapper({ selected: false })

    expect(screen.getByTestId('selection-border')).toBeInTheDocument()
    expect(screen.queryAllByTestId('resize-control')).toHaveLength(0)
  })

  it('hides the local selection border for excluded committed nodes while keeping committed resize handles', () => {
    setCanvasPendingSelectionPreview({ nodeIds: ['other-node'], edgeIds: [] })
    renderWrapper({ selected: true })

    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryAllByTestId('resize-control')).toHaveLength(4)
  })
})

function renderWrapper({ selected }: { selected: boolean }) {
  useCanvasSelectionState.getState().setSelection({
    nodeIds: selected ? ['node-1'] : [],
    edgeIds: [],
  })

  return render(
    <CanvasProviders runtime={createProviderValues()}>
      <ResizableNodeWrapper id="node-1" nodeType="test" dragging={false}>
        <div>node body</div>
      </ResizableNodeWrapper>
    </CanvasProviders>,
  )
}

function createProviderValues() {
  return {
    canEdit: true,
    remoteHighlights: new Map(),
    history: {
      canUndo: false,
      canRedo: false,
      undo: () => undefined,
      redo: () => undefined,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEditNodeId: null,
      setPendingEditNodeId: () => undefined,
    },
    nodeActions: {
      updateNodeData: () => undefined,
      onResize: () => undefined,
      onResizeEnd: () => undefined,
    },
  }
}
