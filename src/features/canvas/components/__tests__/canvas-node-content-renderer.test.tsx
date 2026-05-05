import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasNodeContentRenderer } from '../canvas-node-content-renderer'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasEngine } from '../../system/canvas-engine'
import type {
  CanvasNodeComponentDataByType,
  CanvasNodeComponentProps,
} from '../../nodes/canvas-node-types'
import type { CanvasNodeRendererMap } from '../canvas-node-content-renderer'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

function TextRenderer({
  id,
  type,
}: CanvasNodeComponentProps<CanvasNodeComponentDataByType['text']>) {
  return (
    <div data-testid="text-renderer" data-node-id={id} data-node-type={type}>
      Text fallback
    </div>
  )
}

const renderers = {
  text: TextRenderer,
} satisfies CanvasNodeRendererMap

function buildEngineWithUnknownNode() {
  const engine = createCanvasEngine()
  engine.setDocumentSnapshot({
    nodes: [
      {
        id: 'node-1',
        type: 'unknown',
        position: { x: 0, y: 0 },
        width: 100,
        height: 50,
        data: {},
      } as unknown as CanvasDocumentNode,
    ],
  })
  return engine
}

describe('CanvasNodeContentRenderer', () => {
  it('falls back to the text renderer for unknown node types', () => {
    const onUnknownNodeType = vi.fn()
    const engine = buildEngineWithUnknownNode()

    render(
      <CanvasEngineProvider engine={engine}>
        <CanvasNodeContentRenderer
          nodeId="node-1"
          renderers={renderers}
          onUnknownNodeType={onUnknownNodeType}
        />
      </CanvasEngineProvider>,
    )

    expect(screen.getByTestId('text-renderer')).toHaveAttribute('data-node-id', 'node-1')
    expect(screen.getByTestId('text-renderer')).toHaveAttribute('data-node-type', 'text')
    expect(onUnknownNodeType).toHaveBeenCalledTimes(1)
    expect(onUnknownNodeType).toHaveBeenCalledWith('unknown', ['text'])
  })

  it('reports each unknown node type once per renderer instance', () => {
    const onUnknownNodeType = vi.fn()
    const engine = buildEngineWithUnknownNode()

    const { rerender } = render(
      <CanvasEngineProvider engine={engine}>
        <CanvasNodeContentRenderer
          nodeId="node-1"
          renderers={renderers}
          onUnknownNodeType={onUnknownNodeType}
        />
      </CanvasEngineProvider>,
    )
    rerender(
      <CanvasEngineProvider engine={engine}>
        <CanvasNodeContentRenderer
          nodeId="node-1"
          renderers={renderers}
          onUnknownNodeType={onUnknownNodeType}
        />
      </CanvasEngineProvider>,
    )

    expect(onUnknownNodeType).toHaveBeenCalledTimes(1)
  })
})
