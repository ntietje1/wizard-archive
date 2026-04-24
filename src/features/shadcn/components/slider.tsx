'use client'

import * as React from 'react'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'

import { cn } from '~/features/shadcn/lib/utils'

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  orientation = 'horizontal',
  ...props
}: SliderPrimitive.Root.Props) {
  const isVertical = orientation === 'vertical'
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )

  return (
    <SliderPrimitive.Root
      className={cn(isVertical ? 'h-full' : 'w-full', 'cursor-pointer', className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      orientation={orientation}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          'relative flex touch-none items-center select-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
          isVertical ? 'h-full min-h-40 w-6 flex-col' : 'h-6 w-full',
        )}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            'bg-muted relative overflow-hidden rounded-full select-none',
            isVertical ? 'h-full w-1' : 'h-1.5 w-full',
          )}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className={cn('bg-primary select-none', isVertical ? 'w-full' : 'h-full')}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="border-ring ring-ring/50 relative size-4 rounded-full border bg-white transition-[color,box-shadow] after:absolute after:-inset-3 hover:ring-[3px] focus-visible:ring-[3px] focus-visible:outline-hidden active:ring-[3px] block shrink-0 cursor-pointer select-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
