import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasRuntimeProviders } from '../../../runtime/providers/canvas-runtime-context'
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
})

describe('ResizableNodeWrapper', () => {
  it('renders the normal selection border for pending-only preview nodes without resize handles', () => {
    setCanvasPendingSelectionPreview(['node-1'])
    renderWrapper({ selected: false })

    expect(screen.getByTestId('selection-border')).toBeInTheDocument()
    expect(screen.queryAllByTestId('resize-control')).toHaveLength(0)
  })

  it('hides the local selection border for excluded committed nodes while keeping committed resize handles', () => {
    setCanvasPendingSelectionPreview(['other-node'])
    renderWrapper({ selected: true })

    expect(screen.queryByTestId('selection-border')).toBeNull()
    expect(screen.queryAllByTestId('resize-control')).toHaveLength(4)
  })
})

function renderWrapper({ selected }: { selected: boolean }) {
  return render(
    <CanvasRuntimeProviders value={createProviderValues()}>
      <ResizableNodeWrapper id="node-1" nodeType="test" selected={selected} dragging={false}>
        <div>node body</div>
      </ResizableNodeWrapper>
    </CanvasRuntimeProviders>,
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
