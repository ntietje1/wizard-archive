import { useState } from 'react'
import type { ReactNode } from 'react'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { cn } from '~/features/shadcn/lib/utils'

export function PreviewImage({
  src,
  alt,
  fallback,
  objectFit = 'contain',
  showLoadingIndicator = false,
  onLoad,
  onError,
}: {
  src: string | null
  alt: string
  fallback: ReactNode
  objectFit?: 'contain' | 'cover'
  showLoadingIndicator?: boolean
  onLoad?: () => void
  onError?: () => void
}) {
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const hasError = src !== null && erroredUrl === src

  if (!src || hasError) {
    return <div className="h-full w-full">{fallback}</div>
  }

  const isLoading = showLoadingIndicator && loadedUrl !== src

  return (
    <div className="relative h-full w-full overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        className={cn(
          'h-full w-full transition-opacity',
          objectFit === 'cover' ? 'object-cover' : 'object-contain',
          isLoading ? 'opacity-0' : 'opacity-100',
        )}
        draggable={false}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => {
          setLoadedUrl(src)
          onLoad?.()
        }}
        onError={() => {
          setErroredUrl(src)
          onError?.()
        }}
      />
    </div>
  )
}
