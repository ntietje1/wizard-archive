import { ClientOnly } from '@tanstack/react-router'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import type { CanvasViewerSessionProps, CanvasViewerSource } from './canvas-viewer-source'
import type { ViewerProps } from '~/shared/viewer/viewer-props'
import type { CanvasWithContent } from 'shared/canvases/types'

export function CanvasViewer({
  item: canvas,
  source,
}: ViewerProps<CanvasWithContent> & {
  source: CanvasViewerSource
}) {
  const SourceComponent = source.SourceComponent

  return (
    <ClientOnly fallback={null}>
      <SourceComponent canvas={canvas} source={source} />
    </ClientOnly>
  )
}

export function CanvasViewerSession({
  contextMenuSource,
  session,
  source,
}: CanvasViewerSessionProps) {
  if (session.status === 'error') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <p>
          {typeof session.error === 'string'
            ? session.error
            : session.error?.message || 'Failed to load canvas. Please try refreshing the page.'}
        </p>
      </div>
    )
  }

  if (session.status === 'loading') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const RuntimeComponent = source.RuntimeComponent

  return (
    <RuntimeComponent contextMenuSource={contextMenuSource} session={session} source={source} />
  )
}
