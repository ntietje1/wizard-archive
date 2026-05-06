import { CanvasSceneViewport } from './canvas-scene-viewport'
import {
  CanvasPreviewEdgeRenderer,
  CanvasPreviewNodeRenderer,
} from './canvas-read-only-preview-renderers'
import { useCanvasReadOnlyPreviewRuntime } from './canvas-read-only-preview-runtime'
import { CanvasEngineProvider } from '../react/canvas-engine-context'
import { CanvasRenderModeProvider } from '../runtime/providers/canvas-render-mode-context'
import { cn } from '~/features/shadcn/lib/utils'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type { MouseEvent as ReactMouseEvent } from 'react'

const DEFAULT_MIN_ZOOM = 0.01
const DEFAULT_MAX_ZOOM = 4
const DEFAULT_FIT_PADDING = 0.12

interface CanvasReadOnlyPreviewProps {
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
  interactive?: boolean
  fitPadding?: number
  minZoom?: number
  maxZoom?: number
  className?: string
}

export function CanvasReadOnlyPreview({
  nodes,
  edges,
  interactive = false,
  fitPadding = DEFAULT_FIT_PADDING,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  className,
}: CanvasReadOnlyPreviewProps) {
  const { backgroundRef, canvasEngine, domRuntime, surfaceRef, viewportRef } =
    useCanvasReadOnlyPreviewRuntime({
      edges,
      fitPadding,
      interactive,
      maxZoom,
      minZoom,
      nodes,
    })

  return (
    <CanvasEngineProvider engine={canvasEngine}>
      <CanvasRenderModeProvider mode="embedded-readonly">
        <CanvasSceneViewport
          engine={canvasEngine}
          domRuntime={domRuntime}
          surfaceRef={surfaceRef}
          viewportRef={viewportRef}
          backgroundRef={backgroundRef}
          backgroundTestId="canvas-read-only-preview-background"
          testId="canvas-read-only-preview"
          className={cn('relative h-full w-full min-h-0 min-w-0', className)}
          surfaceProps={{
            role: 'application',
            'aria-label': 'Canvas preview',
            tabIndex: -1,
            onContextMenu: preventCanvasPreviewMenu,
          }}
        >
          <CanvasPreviewEdgeRenderer
            interactive={interactive}
            onEdgeContextMenu={preventCanvasPreviewEdgeMenu}
          />
          <CanvasPreviewNodeRenderer
            interactive={interactive}
            onNodeContextMenu={preventCanvasPreviewNodeMenu}
          />
        </CanvasSceneViewport>
      </CanvasRenderModeProvider>
    </CanvasEngineProvider>
  )
}

function preventCanvasPreviewMenu(event: ReactMouseEvent) {
  event.preventDefault()
}

function preventCanvasPreviewNodeMenu(event: ReactMouseEvent, _node: CanvasDocumentNode) {
  event.preventDefault()
}

function preventCanvasPreviewEdgeMenu(event: ReactMouseEvent, _edge: CanvasDocumentEdge) {
  event.preventDefault()
}
