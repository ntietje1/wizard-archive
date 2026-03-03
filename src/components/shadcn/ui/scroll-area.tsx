'use client'

import * as React from 'react'

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui-components/react/scroll-area'

import { cn } from '~/lib/shadcn/utils'

export type ScrollAreaContextProps = {
  type: 'auto' | 'always' | 'scroll' | 'hover'
}

const ScrollAreaContext = React.createContext<ScrollAreaContextProps>({
  type: 'hover',
})

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    type?: 'auto' | 'always' | 'scroll' | 'hover'
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
      viewportClassName,
      contentClassName,
      viewportRef,
      ...props
    },
    ref,
  ) => {
    return (
      <ScrollAreaContext.Provider value={{ type }}>
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
              'focus-ring size-full rounded-[inherit] overflow-x-hidden w-full max-w-full',
              viewportClassName,
            )}
            style={{ overflowX: 'hidden' }}
          >
            <ScrollAreaPrimitive.Content
              className={cn('w-full max-w-full', contentClassName)}
              style={{ minWidth: 0 }}
            >
              {children}
            </ScrollAreaPrimitive.Content>
          </ScrollAreaPrimitive.Viewport>
          <ScrollBar />
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
  const { type } = React.useContext(ScrollAreaContext)

  return (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={cn(
        'flex touch-none transition-[colors,opacity] duration-150 ease-out select-none shrink-0 absolute',
        orientation === 'vertical' && 'top-0 right-0 bottom-0 w-1 mr-[1px]',
        orientation === 'horizontal' &&
          'left-0 right-0 bottom-0 h-1 flex-col mb-[1px]',
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
