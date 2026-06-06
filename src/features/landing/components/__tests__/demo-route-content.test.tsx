import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoRouteContent } from '../demo-route-content'
import { DemoCanvasEmbedRenderer } from '../demo-canvas-embed-renderer'
import {
  normalizeCanvasDocumentEdge,
  normalizeCanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

const { canvasReadOnlyPreviewMock, staticNoteContentMock } = vi.hoisted(() => ({
  canvasReadOnlyPreviewMock: vi.fn(),
  staticNoteContentMock: vi.fn(),
}))

vi.mock('~/features/canvas/components/canvas-read-only-preview', () => ({
  CanvasReadOnlyPreview: (props: Record<string, unknown>) => {
    canvasReadOnlyPreviewMock(props)
    return <div data-testid="demo-canvas-preview" />
  },
}))

vi.mock('~/features/editor/components/static-note-content', () => ({
  StaticNoteContent: (props: { content: Array<unknown> }) => {
    staticNoteContentMock(props)
    return <div data-testid="demo-note-preview" />
  },
}))

vi.mock('~/features/landing/components/nav-bar', () => ({
  NavBar: () => <nav data-testid="demo-nav" />,
}))

describe('DemoRouteContent', () => {
  beforeEach(() => {
    canvasReadOnlyPreviewMock.mockReset()
    staticNoteContentMock.mockReset()
  })

  it('renders a fixture-backed read-only canvas instead of the placeholder asset', () => {
    render(<DemoRouteContent />)

    expect(screen.getByTestId('demo-nav')).toBeInTheDocument()
    expect(screen.getByTestId('demo-note-preview')).toBeInTheDocument()
    expect(screen.getByTestId('demo-canvas-preview')).toBeInTheDocument()
    expect(screen.queryByLabelText('Demo project preview placeholder')).not.toBeInTheDocument()
    expect(canvasReadOnlyPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fitPadding: 0.18,
        className: 'h-full',
      }),
    )
  })

  it('passes valid static canvas nodes and edges with the demo embed renderer', () => {
    render(<DemoRouteContent />)

    expect(canvasReadOnlyPreviewMock).toHaveBeenCalledTimes(1)
    const props = canvasReadOnlyPreviewMock.mock.calls[0]?.[0] as {
      nodes: Array<unknown>
      edges: Array<unknown>
      embedRenderer?: unknown
    }
    const nodes = props.nodes.map((node) => normalizeCanvasDocumentNode(node))
    const edges = props.edges.map((edge) => normalizeCanvasDocumentEdge(edge))

    expect(nodes).not.toContain(null)
    expect(edges).not.toContain(null)

    expect(nodes.map((node) => [node?.id, node?.type])).toEqual([
      ['scene-brief', 'text'],
      ['map-preview', 'embed'],
      ['encounter-clock', 'text'],
      ['route-line', 'stroke'],
    ])
    expect(edges.map((edge) => [edge?.id, edge?.source, edge?.target])).toEqual([
      ['brief-to-map', 'scene-brief', 'map-preview'],
      ['brief-to-clock', 'scene-brief', 'encounter-clock'],
    ])
    expect(props.embedRenderer).toBe(DemoCanvasEmbedRenderer)
  })

  it('passes a static note fixture through the editor presenter boundary', () => {
    render(<DemoRouteContent />)

    expect(staticNoteContentMock).toHaveBeenCalledTimes(1)
    expect(staticNoteContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({
            id: 'demo-note-heading',
            type: 'heading',
            content: expect.arrayContaining([
              expect.objectContaining({ text: 'The Lantern Market' }),
            ]),
          }),
        ]),
      }),
    )
  })
})
