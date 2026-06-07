import { ClientOnly } from '@tanstack/react-router'
import { Suspense, lazy, useEffect, useRef } from 'react'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { getIntrinsicAspectRatio } from '../utils/embed-media'
import type { ReactNode } from 'react'
import type { EmbedMediaKind, IntrinsicAspectRatioReporter } from '../utils/embed-media'

type MediaEmbedRendererProps = {
  sourceUrl: string
  label: string
  kind: EmbedMediaKind
  onIntrinsicAspectRatio?: IntrinsicAspectRatioReporter
  renderUnknown: () => ReactNode
}

const pdfFallback = (
  <div className="flex h-full w-full items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
)

const LazyPdfFileViewer = lazy(() =>
  import('~/features/editor/components/viewer/file/pdf-file-viewer').then((module) => ({
    default: module.PdfFileViewer,
  })),
)

export function MediaEmbedRenderer({
  sourceUrl,
  label,
  kind,
  onIntrinsicAspectRatio,
  renderUnknown,
}: MediaEmbedRendererProps) {
  const onIntrinsicAspectRatioRef = useRef(onIntrinsicAspectRatio)

  useEffect(() => {
    onIntrinsicAspectRatioRef.current = onIntrinsicAspectRatio
  }, [onIntrinsicAspectRatio])

  useEffect(() => {
    onIntrinsicAspectRatioRef.current?.(null)
  }, [kind, sourceUrl])

  switch (kind) {
    case 'image':
      return (
        <img
          src={sourceUrl}
          alt={label}
          className="block h-full w-full object-contain"
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            onIntrinsicAspectRatioRef.current?.(
              getIntrinsicAspectRatio(naturalWidth, naturalHeight),
            )
          }}
        />
      )
    case 'video':
      return (
        <video
          src={sourceUrl}
          controls
          className="h-full w-full"
          aria-label={label}
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget
            onIntrinsicAspectRatioRef.current?.(getIntrinsicAspectRatio(videoWidth, videoHeight))
          }}
        >
          <track kind="captions" label="Captions unavailable" />
        </video>
      )
    case 'audio':
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
          <audio src={sourceUrl} controls className="w-full" aria-label={label}>
            <track kind="captions" label="Captions unavailable" />
          </audio>
        </div>
      )
    case 'pdf':
      return (
        <ClientOnly fallback={pdfFallback}>
          <Suspense fallback={pdfFallback}>
            <LazyPdfFileViewer
              pdfUrl={sourceUrl}
              onFirstPageAspectRatio={(aspectRatio) => {
                onIntrinsicAspectRatioRef.current?.(aspectRatio)
              }}
            />
          </Suspense>
        </ClientOnly>
      )
    case 'unknown':
      return renderUnknown()
  }
}
