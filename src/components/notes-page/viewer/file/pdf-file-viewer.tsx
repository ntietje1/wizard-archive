import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfToolbar } from './pdf-toolbar'
import { isValidFileUrl } from '~/lib/file-url-validation'
import { LoadingSpinner } from '~/components/loading/loading-spinner'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25

interface PdfFileViewerProps {
  pdfUrl: string
}

function PdfPage({
  pageNumber,
  scale,
  pageRefs,
}: {
  pageNumber: number
  scale: number
  pageRefs: Map<number, HTMLDivElement>
}) {
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) {
        pageRefs.set(pageNumber, el)
      } else {
        pageRefs.delete(pageNumber)
      }
    },
    [pageNumber, pageRefs],
  )

  return (
    <div
      ref={setRef}
      data-page-number={pageNumber}
      className="flex justify-center py-2"
    >
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderAnnotationLayer={true}
        renderForms={true}
        renderTextLayer={true}
        loading={<Skeleton className="w-[612px] h-[792px]" />}
      />
    </div>
  )
}

export function PdfFileViewer({ pdfUrl }: PdfFileViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)

  const isValid = isValidFileUrl(pdfUrl)

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages)
    },
    [],
  )

  // Track the current visible page via IntersectionObserver.
  // Uses a persistent visibility map so every callback considers ALL pages,
  // not just the entries in the current batch. Updates are debounced with rAF
  // to coalesce rapid intersection events into a single state update.
  useEffect(() => {
    if (numPages === 0) return

    const viewport = scrollViewportRef.current
    if (!viewport) return

    const visibilityMap = new Map<number, number>()
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

    for (const [, el] of pageRefs.current) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [numPages])

  const scrollToPage = useCallback((pageNumber: number) => {
    const el = pageRefs.current.get(pageNumber)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1)
    }
  }, [currentPage, scrollToPage])

  const handleNextPage = useCallback(() => {
    if (currentPage < numPages) {
      scrollToPage(currentPage + 1)
    }
  }, [currentPage, numPages, scrollToPage])

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))
  }, [])

  const handleZoomReset = useCallback(() => {
    setScale(1)
  }, [])

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

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-red-500">Invalid PDF URL</p>
          <p className="text-sm mt-2">
            The PDF URL does not meet security requirements.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 bg-background flex flex-col"
    >
      {numPages === 0 && (
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
      <ScrollArea className="flex-1 min-h-0" viewportRef={scrollViewportRef}>
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={null}
          error={
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Failed to load PDF</p>
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => {
            const pageNumber = i + 1
            return (
              <PdfPage
                key={pageNumber}
                pageNumber={pageNumber}
                scale={scale}
                pageRefs={pageRefs.current}
              />
            )
          })}
        </Document>
      </ScrollArea>
    </div>
  )
}
