import * as React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'

import { cn } from '~/lib/utils'

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  const [isScrollbarVisible, setIsScrollbarVisible] = React.useState(false)
  const viewportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const checkScrollbarVisibility = () => {
      const hasVerticalScrollbar = viewport.scrollHeight > viewport.clientHeight
      setIsScrollbarVisible(hasVerticalScrollbar)
    }

    // Check initially
    checkScrollbarVisibility()

    // Set up ResizeObserver to detect content changes
    const resizeObserver = new ResizeObserver(checkScrollbarVisibility)
    resizeObserver.observe(viewport)

    // Also observe the first child (content) for changes
    const contentElement = viewport.firstElementChild
    if (contentElement) {
      resizeObserver.observe(contentElement)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [children])

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        data-scrollbar-visible={isScrollbarVisible}
        className={cn(
          'focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow,padding-right] outline-none focus-visible:ring-[3px] focus-visible:outline-1',
          // Override Radix's inner div styles that cause width issues
          '[&>div]:!min-w-0 [&>div]:!block [&>div]:!table-auto',
          // Conditional right padding when scrollbar is visible
          'data-[scrollbar-visible=true]:pr-1.5',
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' &&
          'h-full w-2 border-l border-l-transparent',
        orientation === 'horizontal' &&
          'h-2 flex-col border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
