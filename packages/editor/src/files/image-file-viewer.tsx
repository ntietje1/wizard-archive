import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

export function ImageFileViewer({ alt, url }: { alt: string; url: string }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-6" role="alert">
        <p className="text-sm text-muted-foreground">Failed to load image</p>
      </div>
    )
  }

  return (
    <TransformWrapper
      centerOnInit
      initialScale={1}
      limitToBounds={false}
      maxScale={4}
      minScale={0.5}
      wheel={{ step: 0.1 }}
    >
      {({ resetTransform, zoomIn, zoomOut }) => (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
          <div className="absolute right-4 top-4 z-10 flex gap-1 rounded-md border bg-background p-1 shadow-sm">
            <ImageControl label="Zoom out" onClick={() => zoomOut()} icon={ZoomOut} />
            <ImageControl label="Reset zoom" onClick={() => resetTransform()} icon={RotateCcw} />
            <ImageControl label="Zoom in" onClick={() => zoomIn()} icon={ZoomIn} />
          </div>
          {!loaded && (
            <output
              aria-label="Loading image"
              className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
            >
              Loading image…
            </output>
          )}
          <TransformComponent
            wrapperClass="!h-full !w-full"
            contentClass="!flex !h-full !w-full !items-center !justify-center"
          >
            <img
              alt={alt}
              className="block max-h-none max-w-none select-none"
              draggable={false}
              src={url}
              onError={() => setFailed(true)}
              onLoad={() => setLoaded(true)}
            />
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  )
}

function ImageControl({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ZoomIn
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded hover:bg-muted"
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}
