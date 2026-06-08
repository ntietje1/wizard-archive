import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
// eslint-disable-next-line import/default
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfToolbar } from './pdf-toolbar'
import { isValidFileUrl } from '~/features/file-upload/utils/file-url-validation'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { getIntrinsicAspectRatio } from '~/features/embeds/utils/embed-media'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25

type PdfDocumentState =
  | { status: 'loading' }
  | { status: 'ready'; numPages: number }
  | { status: 'failed' }

interface PdfFileViewerProps {
  pdfUrl: string
  onFirstPageAspectRatio?: (aspectRatio: number | null) => void
}

function PdfPage({
  pageNumber,
  scale,
  pageRefs,
  onFirstPageAspectRatio,
}: {
  pageNumber: number
  scale: number
  pageRefs: Map<number, HTMLDivElement>
  onFirstPageAspectRatio?: (aspectRatio: number | null) => void
}) {
  const setRef = (el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.set(pageNumber, el)
    } else {
      pageRefs.delete(pageNumber)
    }
  }

  return (
    <div ref={setRef} data-page-number={pageNumber} className="flex justify-center py-2">
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderForms={true}
        loading={<div className="bg-muted w-[612px] h-[792px]" />}
        onLoadSuccess={(page) => {
          if (pageNumber !== 1) return
          onFirstPageAspectRatio?.(getIntrinsicAspectRatio(page.originalWidth, page.originalHeight))
        }}
      />
    </div>
  )
}

export function PdfFileViewer({ pdfUrl, onFirstPageAspectRatio }: PdfFileViewerProps) {
  const [documentState, setDocumentState] = useState<PdfDocumentState>({ status: 'loading' })
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1)
  const pageRefs = useRef<Map<number, HTMLDivElement> | null>(null)
  if (pageRefs.current === null) {
    pageRefs.current = new Map()
  }
  const pageRefsMap = pageRefs.current
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)

  const isValid = isValidFileUrl(pdfUrl)
  const numPages = documentState.status === 'ready' ? documentState.numPages : 0

  const handleDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setDocumentState({ status: 'ready', numPages: pages })
  }

  const handleDocumentLoadError = () => {
    setDocumentState({ status: 'failed' })
    onFirstPageAspectRatio?.(null)
  }

  // Track the current visible page via IntersectionObserver.
  // Uses a persistent visibility map so every callback considers ALL pages,
  // not just the entries in the current batch. Updates are debounced with rAF
  // to coalesce rapid intersection events into a single state update.
  useEffect(() => {
    if (numPages === 0) return

    const viewport = scrollViewportRef.current
    if (!viewport) return

    const visibilityMap: Map<number, number> = new Map()
    let rafId: number | null = null

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNum = Number(entry.target.getAttribute('data-page-number'))
          if (!isNaN(pageNum)) {
            visibilityMap.set(pageNum, entry.intersectionRatio)
          }
        }

        if (rafId !== null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          let maxRatio = 0
          let mostVisiblePage = 1
          for (const [pageNum, ratio] of visibilityMap) {
            if (ratio > maxRatio) {
              maxRatio = ratio
              mostVisiblePage = pageNum
            }
          }
          if (maxRatio > 0) {
            setCurrentPage(mostVisiblePage)
          }
          rafId = null
        })
      },
      {
        root: viewport,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    for (const [, el] of pageRefsMap) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [numPages, pageRefsMap])

  const scrollToPage = (pageNumber: number) => {
    const el = pageRefsMap.get(pageNumber)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < numPages) {
      scrollToPage(currentPage + 1)
    }
  }

  const handleZoomIn = () => {
    setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))
  }

  const handleZoomOut = () => {
    setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))
  }

  const handleZoomReset = () => {
    setScale(1)
  }

  // Ctrl+wheel / pinch-to-zoom on the PDF viewer
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)))
    }

    el.addEventListener('wheel', handleWheel, { passive: true })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-destructive">Invalid PDF URL</p>
          <p className="text-sm mt-2">The PDF URL does not meet security requirements.</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-0 bg-background flex flex-col">
      {documentState.status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {numPages > 0 && (
        <PdfToolbar
          currentPage={currentPage}
          numPages={numPages}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
        />
      )}
      <ScrollArea
        className="flex-1 min-h-0"
        scrollOrientation="both"
        viewportRef={scrollViewportRef}
      >
        {documentState.status === 'failed' ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Failed to load PDF</p>
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={null}
          >
            {Array.from({ length: numPages }, (_, i) => {
              const pageNumber = i + 1
              return (
                <PdfPage
                  key={pageNumber}
                  pageNumber={pageNumber}
                  scale={scale}
                  pageRefs={pageRefsMap}
                  onFirstPageAspectRatio={onFirstPageAspectRatio}
                />
              )
            })}
          </Document>
        )}
      </ScrollArea>
    </div>
  )
}
