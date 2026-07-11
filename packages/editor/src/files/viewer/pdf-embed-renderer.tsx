import { lazy, Suspense } from 'react'
import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { EmbedLoadingState } from '../../embeds/components/embed-loading-state'
import type { PdfFileViewerProps } from './pdf-file-viewer'
import { PdfFailureMessage } from './pdf-failure-message'

const LazyPdfFileViewer = lazy(() =>
  import('./pdf-file-viewer').then((module) => ({
    default: module.PdfFileViewer,
  })),
)

export const PdfEmbedRenderer = (props: PdfFileViewerProps) => (
  <ErrorBoundary key={props.pdfUrl} fallback={<PdfFailureMessage />}>
    <Suspense fallback={<EmbedLoadingState label="Loading PDF" />}>
      <LazyPdfFileViewer {...props} />
    </Suspense>
  </ErrorBoundary>
)
