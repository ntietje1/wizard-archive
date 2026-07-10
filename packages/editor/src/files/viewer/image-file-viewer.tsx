import { useRef, useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { isValidFileUrl } from './file-url-validation'
import { InvalidFileUrlMessage } from './invalid-file-url-message'
import { ZoomControls } from '@wizard-archive/ui/components/zoom/zoom-controls'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'

interface ImageFileViewerProps {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  imageUrl: string
  alt: string
}

export function ImageFileViewer({
  allowDataUrl = false,
  allowObjectUrl = false,
  imageUrl,
  alt,
}: ImageFileViewerProps) {
  const isValid = isValidFileUrl(imageUrl, { allowDataUrl, allowObjectUrl })

  if (!isValid) {
    return <InvalidFileUrlMessage fileType="Image" />
  }

  return <ImageFileContent key={imageUrl} imageUrl={imageUrl} alt={alt} />
}

function ImageFileContent({ imageUrl, alt }: { imageUrl: string; alt: string }) {
  const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleZoomIn = () => {
    transformWrapperRef.current?.zoomIn()
  }

  const handleZoomOut = () => {
    transformWrapperRef.current?.zoomOut()
  }

  const handleResetTransform = () => {
    transformWrapperRef.current?.resetTransform()
  }

  const handleImageError = () => {
    setImageError(true)
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col">
      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleResetTransform}
        className="absolute top-4 right-4 z-[1000]"
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
                <div
                  className="flex items-center justify-center h-full w-full text-muted-foreground"
                  role="alert"
                >
                  <p>Failed to load image</p>
                </div>
              ) : (
                <img
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
