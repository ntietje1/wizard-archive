import { useCallback, useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { isValidFileUrl } from '~/lib/file-url-validation'
import { ZoomControls } from '~/components/viewer-controls/zoom-controls'
import { LoadingSpinner } from '~/components/loading/loading-spinner'

interface ImageFileViewerProps {
  imageUrl: string
  alt: string
}

export function ImageFileViewer({ imageUrl, alt }: ImageFileViewerProps) {
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const isValid = isValidFileUrl(imageUrl)

  const handleZoomIn = useCallback(() => {
    transformWrapperRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    transformWrapperRef.current?.zoomOut()
  }, [])

  const handleResetTransform = useCallback(() => {
    transformWrapperRef.current?.resetTransform()
  }, [])

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  if (!isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center p-4">
          <p className="text-lg font-medium text-destructive">
            Invalid Image URL
          </p>
          <p className="text-sm mt-2">
            The image URL does not meet security requirements.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col">
      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleResetTransform}
      />

      <div className="flex-1 relative min-h-0">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 z-[999] flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}
        <TransformWrapper
          ref={transformWrapperRef}
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: false }}
          panning={{ disabled: false }}
          limitToBounds={false}
          centerOnInit={true}
        >
          <TransformComponent
            wrapperClass="!w-full !h-full"
            contentClass="!w-full !h-full flex items-center justify-center"
          >
            <div className="relative">
              {imageError ? (
                <div className="flex items-center justify-center h-full w-full text-muted-foreground">
                  <p>Failed to load image</p>
                </div>
              ) : (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={alt}
                  className="select-none pointer-events-auto"
                  draggable={false}
                  style={{
                    cursor: 'default',
                    display: 'block',
                  }}
                  onLoad={() => setImageLoaded(true)}
                  onError={handleImageError}
                />
              )}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  )
}
