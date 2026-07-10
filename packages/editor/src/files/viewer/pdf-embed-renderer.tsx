import { lazy, Suspense } from 'react'
import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { EmbedLoadingState } from '../../embeds/components/embed-loading-state'
import type { PdfFileViewerProps } from './pdf-file-viewer'

const LazyPdfFileViewer = lazy(() =>
  import('./pdf-file-viewer').then((module) => ({
    default: module.PdfFileViewer,
  })),
)

export const PdfEmbedRenderer = (props: PdfFileViewerProps) => (
  <ErrorBoundary key={props.pdfUrl} fallback={<PdfEmbedFailure />}>
    <Suspense fallback={<EmbedLoadingState label="Loading PDF" />}>
      <LazyPdfFileViewer {...props} />
    </Suspense>
  </ErrorBoundary>
)

function PdfEmbedFailure() {
  return (
    <div className="flex h-full w-full items-center justify-center p-4" role="alert">
      <p className="text-sm text-muted-foreground">Failed to load PDF</p>
    </div>
  )
}
