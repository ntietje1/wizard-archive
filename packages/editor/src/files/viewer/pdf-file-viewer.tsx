import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
// eslint-disable-next-line import/default
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfToolbar } from './pdf-toolbar'
import { isValidFileUrl } from './file-url-validation'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { getIntrinsicAspectRatio } from '../../embeds/utils/media'
import {
  DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT,
  DOCUMENT_EMBED_ASPECT_RATIO_WIDTH,
} from '../../embeds/utils/document-layout'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { InvalidFileUrlMessage } from './invalid-file-url-message'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.25
const PDF_PAGE_RENDER_WINDOW_RADIUS = 2

type PdfDocumentState =
  | { status: 'loading' }
  | { status: 'ready'; numPages: number }
  | { status: 'failed' }

export interface PdfFileViewerProps {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  pdfUrl: string
  onFirstPageAspectRatio?: (aspectRatio: number | null) => void
  presentation?: 'full' | 'embed'
  allowInnerScroll?: boolean
}

function PdfPage({
  pageWidth,
  pageNumber,
  presentation,
  renderPage,
  scale,
  pageRefs,
  onFirstPageAspectRatio,
}: {
  pageWidth?: number
  pageNumber: number
  presentation: 'full' | 'embed'
  renderPage: boolean
  scale: number
  pageRefs: Map<number, HTMLDivElement>
  onFirstPageAspectRatio?: (aspectRatio: number | null) => void
}) {
  const pageElementRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const element = pageElementRef.current
    if (!element) {
      pageRefs.delete(pageNumber)
      return
    }

    pageRefs.set(pageNumber, element)
    return () => {
      if (pageRefs.get(pageNumber) === element) {
        pageRefs.delete(pageNumber)
      }
    }
  }, [pageNumber, pageRefs])

  return (
    <div
      ref={pageElementRef}
      data-page-number={pageNumber}
      className={
        presentation === 'embed' ? 'flex w-full justify-center' : 'flex justify-center py-2'
      }
    >
      {renderPage ? (
        <Page
          pageNumber={pageNumber}
          scale={pageWidth ? undefined : scale}
          width={pageWidth}
          renderForms={true}
          loading={<PdfPageLoadingPlaceholder width={pageWidth} />}
          onLoadSuccess={(page) => {
            if (pageNumber !== 1) return
            onFirstPageAspectRatio?.(
              getIntrinsicAspectRatio(page.originalWidth, page.originalHeight),
            )
          }}
        />
      ) : (
        <PdfPageLoadingPlaceholder
          testId={`pdf-page-placeholder-${pageNumber}`}
          width={pageWidth ?? DOCUMENT_EMBED_ASPECT_RATIO_WIDTH * scale}
        />
      )}
    </div>
  )
}

export function PdfFileViewer({
  allowDataUrl = false,
  allowObjectUrl = false,
  pdfUrl,
  onFirstPageAspectRatio,
  ...contentProps
}: PdfFileViewerProps) {
  const isValidUrl = isValidFileUrl(pdfUrl, { allowDataUrl, allowObjectUrl })

  if (!isValidUrl) {
    return <InvalidPdfUrlNotice pdfUrl={pdfUrl} onFirstPageAspectRatio={onFirstPageAspectRatio} />
  }

  return (
    <PdfFileViewerContent
      pdfUrl={pdfUrl}
      onFirstPageAspectRatio={onFirstPageAspectRatio}
      {...contentProps}
      key={pdfUrl}
    />
  )
}

interface InvalidPdfUrlNoticeProps {
  pdfUrl: string
  onFirstPageAspectRatio?: (aspectRatio: number | null) => void
}

function InvalidPdfUrlNotice({ pdfUrl, onFirstPageAspectRatio }: InvalidPdfUrlNoticeProps) {
  const reportedUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (reportedUrlRef.current === pdfUrl) return
    reportedUrlRef.current = pdfUrl
    onFirstPageAspectRatio?.(null)
  }, [onFirstPageAspectRatio, pdfUrl])

  return (
    <div className="h-full w-full">
      <InvalidFileUrlMessage fileType="PDF" />
    </div>
  )
}

function PdfFileViewerContent({
  pdfUrl,
  onFirstPageAspectRatio,
  presentation = 'full',
  allowInnerScroll = true,
}: PdfFileViewerProps) {
  const [documentState, setDocumentState] = useState<PdfDocumentState>({ status: 'loading' })
  const [currentPage, setCurrentPage] = useState(1)
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const pageRefsMap = useStablePageRefs()
  const { scrollViewportRef, scrollViewportElement, setScrollViewport } = usePdfScrollViewport()
  const scrollViewportSize = useElementSize(scrollViewportElement)
  const { scale, handleWheelZoom, handleZoomIn, handleZoomOut, handleZoomReset } = usePdfZoom({
    enabled: presentation !== 'embed',
  })

  const numPages = documentState.status === 'ready' ? documentState.numPages : 0
  const hasMultiplePages = numPages > 1
  const innerScrollEnabled = presentation !== 'embed' || allowInnerScroll || !hasMultiplePages

  const handleDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setDocumentState({ status: 'ready', numPages: pages })
  }

  const handleDocumentLoadError = () => {
    setDocumentState({ status: 'failed' })
    onFirstPageAspectRatio?.(null)
  }

  usePdfCurrentPageTracking({
    numPages,
    pageRefsMap,
    scrollViewportRef,
    setCurrentPage,
  })
  usePdfNativeWheelZoom(viewerRef, handleWheelZoom)

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

  return (
    <div
      ref={viewerRef}
      data-testid="pdf-file-viewer"
      data-presentation={presentation}
      data-inner-scroll-enabled={innerScrollEnabled ? 'true' : 'false'}
      className={cn(
        'relative flex h-full min-h-0 w-full min-w-full flex-col bg-background',
        presentation === 'embed' && allowInnerScroll && hasMultiplePages && 'nowheel',
      )}
    >
      {documentState.status === 'loading' && <PdfLoadingOverlay />}
      {presentation === 'full' && numPages > 0 && (
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
        contentClassName={presentation === 'embed' ? 'w-full max-w-full' : 'min-w-full'}
        scrollOrientation={
          presentation === 'embed' ? (innerScrollEnabled ? 'vertical' : 'none') : 'both'
        }
        viewportRef={setScrollViewport}
      >
        {documentState.status === 'failed' ? (
          <PdfLoadFailure />
        ) : (
          <PdfDocumentPages
            currentPage={currentPage}
            numPages={numPages}
            onDocumentLoadSuccess={handleDocumentLoadSuccess}
            onDocumentLoadError={handleDocumentLoadError}
            onFirstPageAspectRatio={onFirstPageAspectRatio}
            pageRefs={pageRefsMap}
            pdfUrl={pdfUrl}
            presentation={presentation}
            scale={scale}
            scrollViewportWidth={scrollViewportSize.width}
          />
        )}
      </ScrollArea>
    </div>
  )
}

function PdfLoadingOverlay() {
  return (
    <output
      aria-label="Loading PDF"
      className="absolute inset-0 z-10 flex h-full w-full min-w-full items-center justify-center"
    >
      <LoadingSpinner size="lg" aria-label="Loading PDF indicator" />
    </output>
  )
}

function PdfLoadFailure() {
  return (
    <div className="flex items-center justify-center py-20" role="alert">
      <p className="text-muted-foreground">Failed to load PDF</p>
    </div>
  )
}

function PdfDocumentPages({
  currentPage,
  numPages,
  onDocumentLoadError,
  onDocumentLoadSuccess,
  onFirstPageAspectRatio,
  pageRefs,
  pdfUrl,
  presentation,
  scale,
  scrollViewportWidth,
}: {
  currentPage: number
  numPages: number
  onDocumentLoadError: () => void
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void
  onFirstPageAspectRatio?: (aspectRatio: number | null) => void
  pageRefs: Map<number, HTMLDivElement>
  pdfUrl: string
  presentation: 'full' | 'embed'
  scale: number
  scrollViewportWidth: number
}) {
  const pageWidth =
    presentation === 'embed' && scrollViewportWidth > 0
      ? Math.floor(scrollViewportWidth)
      : undefined

  return (
    <Document
      file={pdfUrl}
      onLoadSuccess={onDocumentLoadSuccess}
      onLoadError={onDocumentLoadError}
      loading={null}
      className={presentation === 'embed' ? 'w-full' : undefined}
    >
      {Array.from({ length: numPages }, (_, i) => {
        const pageNumber = i + 1
        const renderPage = Math.abs(pageNumber - currentPage) <= PDF_PAGE_RENDER_WINDOW_RADIUS
        return (
          <PdfPage
            key={pageNumber}
            pageWidth={pageWidth}
            pageNumber={pageNumber}
            presentation={presentation}
            renderPage={renderPage}
            scale={scale}
            pageRefs={pageRefs}
            onFirstPageAspectRatio={onFirstPageAspectRatio}
          />
        )
      })}
    </Document>
  )
}

function useStablePageRefs() {
  const pageRefs = useRef<Map<number, HTMLDivElement> | null>(null)
  if (pageRefs.current === null) {
    pageRefs.current = new Map()
  }
  return pageRefs.current
}

function usePdfScrollViewport() {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const setScrollViewportRef = useRef<((element: HTMLDivElement | null) => void) | null>(null)
  const [scrollViewportElement, setScrollViewportElement] = useState<HTMLDivElement | null>(null)

  if (!setScrollViewportRef.current) {
    setScrollViewportRef.current = (element: HTMLDivElement | null) => {
      scrollViewportRef.current = element
      setScrollViewportElement(element)
    }
  }

  return {
    scrollViewportRef,
    scrollViewportElement,
    setScrollViewport: setScrollViewportRef.current,
  }
}

function usePdfCurrentPageTracking({
  numPages,
  pageRefsMap,
  scrollViewportRef,
  setCurrentPage,
}: {
  numPages: number
  pageRefsMap: Map<number, HTMLDivElement>
  scrollViewportRef: RefObject<HTMLDivElement | null>
  setCurrentPage: Dispatch<SetStateAction<number>>
}) {
  useEffect(() => {
    if (numPages === 0) return

    const viewport = scrollViewportRef.current
    if (!viewport) return
    if (typeof IntersectionObserver === 'undefined') return

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
  }, [numPages, pageRefsMap, scrollViewportRef, setCurrentPage])
}

function usePdfZoom({ enabled }: { enabled: boolean }) {
  const [scale, setScale] = useState(1)

  const handleZoomIn = () => {
    setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))
  }

  const handleZoomOut = () => {
    setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))
  }

  const handleZoomReset = () => {
    setScale(1)
  }

  const handleWheelZoom = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    if (!enabled) return
    event.preventDefault()
    const delta = event.deltaY > 0 ? -SCALE_STEP : SCALE_STEP
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)))
  }

  return { scale, handleWheelZoom, handleZoomIn, handleZoomOut, handleZoomReset }
}

function usePdfNativeWheelZoom(
  viewerRef: RefObject<HTMLDivElement | null>,
  handleWheelZoom: (event: WheelEvent) => void,
) {
  const handleWheelZoomRef = useRef(handleWheelZoom)
  handleWheelZoomRef.current = handleWheelZoom

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    const handleWheel = (event: WheelEvent) => handleWheelZoomRef.current(event)
    viewer.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewer.removeEventListener('wheel', handleWheel)
  }, [viewerRef])
}

function PdfPageLoadingPlaceholder({ testId, width }: { testId?: string; width?: number }) {
  return (
    <div
      data-testid={testId}
      className="bg-muted"
      style={{
        aspectRatio: `${DOCUMENT_EMBED_ASPECT_RATIO_WIDTH} / ${DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT}`,
        width: width ? `${width}px` : DOCUMENT_EMBED_ASPECT_RATIO_WIDTH,
      }}
    />
  )
}

function useElementSize(element: HTMLElement | null) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (!element) return

    const updateSize = (nextWidth: number, nextHeight: number) => {
      const width = Math.max(0, Math.round(nextWidth))
      const height = Math.max(0, Math.round(nextHeight))
      setSize((current) => {
        if (current.width === width && current.height === height) return current
        return { width, height }
      })
    }

    const rect = element.getBoundingClientRect()
    updateSize(rect.width, rect.height)

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      updateSize(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return size
}
