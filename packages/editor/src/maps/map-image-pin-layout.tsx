import type { ComponentPropsWithoutRef, ReactNode, RefObject } from 'react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

export function MapImagePinLayout({
  alt,
  children,
  className,
  imageRef,
  pins,
  src,
  ...surfaceProps
}: Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  alt: string
  children?: ReactNode
  imageRef?: RefObject<HTMLImageElement | null>
  pins: ReactNode
  src: string
}) {
  return (
    <div
      {...surfaceProps}
      className={cn('relative max-h-full max-w-full', className)}
      data-slot="map-image-pin-layout"
    >
      <img
        ref={imageRef}
        alt={alt}
        className="block max-h-full max-w-full select-none"
        draggable={false}
        src={src}
      />
      <div className="pointer-events-none absolute inset-0" data-slot="map-pin-layer">
        {pins}
      </div>
      {children}
    </div>
  )
}
