import { render, screen } from '@testing-library/react'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import { describe, expect, it } from 'vite-plus/test'
import { CanvasNodeContentRenderer } from '../canvas-node-content-renderer'
import { CanvasEngineProvider } from '../../react/canvas-engine-context'
import { createCanvasEngine } from '../../system/canvas-engine'
import type { CanvasNodeComponentProps } from '../../nodes/canvas-node-types'
import type { CanvasNodeRendererMap } from '../canvas-node-content-renderer'
import type { CanvasDocumentNode } from '../../document-contract'
function TextRenderer({ id, type }: CanvasNodeComponentProps<'text'>) {
  return (
    <div data-testid="text-renderer" data-node-id={id} data-node-type={type}>
      Text node
    </div>
  )
}

function EmbedRenderer() {
  return <div data-testid="embed-renderer" />
}

function StrokeRenderer() {
  return <div data-testid="stroke-renderer" />
}

const renderers = {
  embed: EmbedRenderer,
  stroke: StrokeRenderer,
  text: TextRenderer,
} satisfies CanvasNodeRendererMap

function buildEngineWithTextNode() {
  const engine = createCanvasEngine()
  engine.setDocumentSnapshot({
    nodes: [
      {
        id: testCanvasNodeId('node-1'),
        type: 'text',
        position: { x: 0, y: 0 },
        width: 100,
        height: 50,
        data: {},
      } satisfies CanvasDocumentNode,
    ],
  })
  return engine
}

describe('CanvasNodeContentRenderer', () => {
  it('renders the matching node type from the validated engine snapshot', () => {
    const engine = buildEngineWithTextNode()
    try {
      render(
        <CanvasEngineProvider engine={engine}>
          <CanvasNodeContentRenderer nodeId={testCanvasNodeId('node-1')} renderers={renderers} />
        </CanvasEngineProvider>,
      )

      expect(screen.getByTestId('text-renderer')).toHaveAttribute(
        'data-node-id',
        testCanvasNodeId('node-1'),
      )
      expect(screen.getByTestId('text-renderer')).toHaveAttribute('data-node-type', 'text')
    } finally {
      engine.destroy()
    }
  })

  it('renders nothing when the node snapshot is missing', () => {
    const engine = buildEngineWithTextNode()
    try {
      render(
        <CanvasEngineProvider engine={engine}>
          <CanvasNodeContentRenderer nodeId="missing-node" renderers={renderers} />
        </CanvasEngineProvider>,
      )

      expect(screen.queryByTestId('text-renderer')).not.toBeInTheDocument()
      expect(screen.queryByTestId('embed-renderer')).not.toBeInTheDocument()
      expect(screen.queryByTestId('stroke-renderer')).not.toBeInTheDocument()
    } finally {
      engine.destroy()
    }
  })
})
