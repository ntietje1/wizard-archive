import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { intrinsicMediaAspectRatio } from '../resources/embed-media-layout'
import type { EmbedMediaLayoutReporter } from '../resources/embed-media-layout'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
// Vite resolves the worker asset URL while react-pdf owns the renderer.
// eslint-disable-next-line import/default
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25

type PdfState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly pages: number }
  | { readonly status: 'failed' }

type PdfFileViewerProps = {
  url: string
} & (
  | Readonly<{ mode: 'embed'; onMediaLayout?: EmbedMediaLayoutReporter }>
  | Readonly<{ mode?: 'viewport'; onMediaLayout?: never }>
)

export function PdfFileViewer(props: PdfFileViewerProps) {
  const { url } = props
  const mode = props.mode ?? 'viewport'
  const onMediaLayout = props.mode === 'embed' ? props.onMediaLayout : undefined
  const [state, setState] = useState<PdfState>({ status: 'loading' })
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1)
  const pages = state.status === 'ready' ? state.pages : 0

  if (state.status === 'failed') {
    return (
      <div className="flex h-full items-center justify-center p-6" role="alert">
        <p className="text-sm text-muted-foreground">Failed to load PDF</p>
      </div>
    )
  }

  if (mode === 'embed') {
    return (
      <div
        className="flex size-full min-h-0 items-center justify-center overflow-hidden bg-background [&_.react-pdf__Page__canvas]:!h-auto [&_.react-pdf__Page__canvas]:!max-h-full [&_.react-pdf__Page__canvas]:!max-w-full"
        data-testid="pdf-file-viewer"
      >
        {state.status === 'loading' && (
          <output
            aria-label="Loading PDF"
            className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground"
          >
            Loading PDF…
          </output>
        )}
        <Document
          file={url}
          loading={null}
          onLoadError={() => setState({ status: 'failed' })}
          onLoadSuccess={({ numPages }) => setState({ status: 'ready', pages: numPages })}
        >
          {pages > 0 && (
            <Page
              pageNumber={1}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              scale={1}
              onLoadSuccess={(loadedPage) => {
                const viewport = loadedPage.getViewport({ scale: 1 })
                onMediaLayout?.({
                  kind: 'intrinsicAspectRatio',
                  aspectRatio: intrinsicMediaAspectRatio(viewport.width, viewport.height),
                })
              }}
            />
          )}
        </Document>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="pdf-file-viewer">
      {pages > 0 && (
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5">
          <div className="flex items-center gap-1">
            <PdfControl
              disabled={page === 1}
              icon={ChevronLeft}
              label="Previous page"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            />
            <span aria-live="polite" className="min-w-24 text-center text-sm text-muted-foreground">
              Page {page} of {pages}
            </span>
            <PdfControl
              disabled={page === pages}
              icon={ChevronRight}
              label="Next page"
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
            />
          </div>
          <div className="flex items-center gap-1">
            <PdfControl
              disabled={scale === MIN_SCALE}
              icon={ZoomOut}
              label="Zoom out"
              onClick={() => setScale((current) => Math.max(MIN_SCALE, current - SCALE_STEP))}
            />
            <PdfControl icon={RotateCcw} label="Reset zoom" onClick={() => setScale(1)} />
            <PdfControl
              disabled={scale === MAX_SCALE}
              icon={ZoomIn}
              label="Zoom in"
              onClick={() => setScale((current) => Math.min(MAX_SCALE, current + SCALE_STEP))}
            />
          </div>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {state.status === 'loading' && (
          <output
            aria-label="Loading PDF"
            className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground"
          >
            Loading PDF…
          </output>
        )}
        <ScrollArea className="size-full" scrollOrientation="both">
          <Document
            file={url}
            loading={null}
            onLoadError={() => setState({ status: 'failed' })}
            onLoadSuccess={({ numPages }) => {
              setPage(1)
              setState({ status: 'ready', pages: numPages })
            }}
          >
            {pages > 0 && (
              <div className="flex min-h-full min-w-full justify-center p-4">
                <Page pageNumber={page} scale={scale} />
              </div>
            )}
          </Document>
        </ScrollArea>
      </div>
    </div>
  )
}

function PdfControl({
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean
  icon: typeof ZoomIn
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded hover:bg-muted disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}
