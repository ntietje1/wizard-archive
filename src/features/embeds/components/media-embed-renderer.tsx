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
  const sanitizedSourceUrl = sanitizeMediaSourceUrl(sourceUrl)

  useEffect(() => {
    onIntrinsicAspectRatioRef.current = onIntrinsicAspectRatio
  }, [onIntrinsicAspectRatio])

  useEffect(() => {
    onIntrinsicAspectRatioRef.current?.(null)
  }, [kind, sourceUrl])

  if (!sanitizedSourceUrl) return renderUnknown()

  switch (kind) {
    case 'image':
      return (
        <img
          src={sanitizedSourceUrl}
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
          src={sanitizedSourceUrl}
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
          <audio src={sanitizedSourceUrl} controls className="w-full" aria-label={label}>
            <track kind="captions" label="Captions unavailable" />
          </audio>
        </div>
      )
    case 'pdf':
      return (
        <ClientOnly fallback={pdfFallback}>
          <Suspense fallback={pdfFallback}>
            <LazyPdfFileViewer
              pdfUrl={sanitizedSourceUrl}
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

function sanitizeMediaSourceUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl)
    if (url.protocol === 'blob:') return url.href
    if (url.protocol !== 'https:') return null
    if (isBlockedBrowserMediaHost(url.hostname)) return null
    return url.href
  } catch {
    return null
  }
}

function isBlockedBrowserMediaHost(hostname: string) {
  const normalized = hostname.toLowerCase()
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    isPrivateIpv4Host(normalized)
  )
}

function isPrivateIpv4Host(hostname: string) {
  const octets = hostname.split('.').map((part) => Number(part))
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false
  }
  const [first = 0, second = 0] = octets
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  )
}
