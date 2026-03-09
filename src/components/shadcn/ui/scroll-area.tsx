'use client'

import * as React from 'react'

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui-components/react/scroll-area'

import { cn } from '~/lib/shadcn/utils'

export type ScrollAreaContextProps = {
  type: 'auto' | 'always' | 'scroll' | 'hover'
  hasBothAxes: boolean
}

const ScrollAreaContext = React.createContext<ScrollAreaContextProps>({
  type: 'hover',
  hasBothAxes: false,
})

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    type?: 'auto' | 'always' | 'scroll' | 'hover'
    scrollOrientation?: 'vertical' | 'horizontal' | 'both'
    viewportClassName?: string
    contentClassName?: string
    viewportRef?: React.Ref<HTMLDivElement>
  }
>(
  (
    {
      className,
      children,
      type = 'hover',
      scrollOrientation = 'vertical',
      viewportClassName,
      contentClassName,
      viewportRef,
      ...props
    },
    ref,
  ) => {
    const hasVertical =
      scrollOrientation === 'vertical' || scrollOrientation === 'both'
    const hasHorizontal =
      scrollOrientation === 'horizontal' || scrollOrientation === 'both'
    const hasBothAxes = hasVertical && hasHorizontal

    return (
      <ScrollAreaContext.Provider value={{ type, hasBothAxes }}>
        <ScrollAreaPrimitive.Root
          ref={ref}
          data-slot="scroll-area"
          className={cn('relative flex overflow-hidden w-full', className)}
          {...props}
        >
          <ScrollAreaPrimitive.Viewport
            ref={viewportRef}
            data-slot="scroll-area-viewport"
            className={cn(
              'focus-ring size-full rounded-[inherit] w-full max-w-full',
              !hasHorizontal && 'overflow-x-hidden',
              !hasVertical && 'overflow-y-hidden',
              viewportClassName,
            )}
            // style={{
            //   ...(!hasHorizontal && { overflowX: 'hidden' }),
            //   ...(!hasVertical && { overflowY: 'hidden' }),
            // }}
          >
            <ScrollAreaPrimitive.Content
              className={cn(
                !hasHorizontal && 'w-full max-w-full',
                contentClassName,
              )}
              style={!hasHorizontal ? { minWidth: 0 } : undefined}
            >
              {children}
            </ScrollAreaPrimitive.Content>
          </ScrollAreaPrimitive.Viewport>
          {hasVertical && <ScrollBar orientation="vertical" />}
          {hasHorizontal && <ScrollBar orientation="horizontal" />}
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
      </ScrollAreaContext.Provider>
    )
  },
)

ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Scrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => {
  const { type, hasBothAxes } = React.useContext(ScrollAreaContext)

  return (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={cn(
        'flex touch-none transition-[colors,opacity] duration-150 ease-out select-none shrink-0 absolute',
        orientation === 'vertical' && 'top-0 right-0 w-1 mr-[1px]',
        orientation === 'vertical' &&
          (hasBothAxes ? 'bottom-[5px]' : 'bottom-0'),
        orientation === 'horizontal' && 'left-0 bottom-0 h-1 flex-col mb-[1px]',
        orientation === 'horizontal' &&
          (hasBothAxes ? 'right-[5px]' : 'right-0'),
        type === 'hover' && 'opacity-0 data-[hovering]:opacity-100',
        type === 'scroll' && 'opacity-0 data-[scrolling]:opacity-100',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn(
          'bg-border relative flex-1 rounded-full',
          orientation === 'vertical' && 'my-1',
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
})

ScrollBar.displayName = ScrollAreaPrimitive.Scrollbar.displayName

export { ScrollArea, ScrollBar }
