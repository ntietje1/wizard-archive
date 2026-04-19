import { render } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasFlowShell } from '../canvas-flow-shell'

const reactFlowMock = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  MiniMap: () => null,
  ReactFlow: (props: Record<string, unknown>) => {
    reactFlowMock.props = props
    return <div data-testid="react-flow">{props.children as React.ReactNode}</div>
  },
  SelectionMode: {
    Partial: 'partial',
  },
}))

vi.mock('../canvas-toolbar', () => ({
  CanvasToolbar: () => null,
}))

vi.mock('../canvas-conditional-toolbar', () => ({
  CanvasConditionalToolbar: () => null,
}))

vi.mock('../canvas-local-overlays-host', () => ({
  CanvasLocalOverlaysHost: () => null,
}))

vi.mock('../canvas-awareness-host', () => ({
  CanvasAwarenessHost: () => null,
}))

vi.mock('../canvas-minimap-node', () => ({
  MiniMapNode: () => null,
}))

describe('CanvasFlowShell', () => {
  it('disables React Flow double click zoom', () => {
    render(
      <CanvasFlowShell
        canEdit
        colorMode="light"
        toolCursor={undefined}
        canvasSurfaceRef={{ current: null }}
        remoteUsers={[]}
        activeTool="select"
        onMouseMove={vi.fn()}
        onMouseLeave={vi.fn()}
        dropOverlayRef={createRef<HTMLDivElement>()}
        isDropTarget={false}
        isFileDropTarget={false}
      />,
    )

    expect(reactFlowMock.props?.zoomOnDoubleClick).toBe(false)
  })
})
