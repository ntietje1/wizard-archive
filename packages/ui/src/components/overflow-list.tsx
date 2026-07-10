import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getOverflowListLayout } from '@wizard-archive/ui/utils/overflow-list-layout'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface OverflowListLayoutState {
  visibleCount: number
  hiddenCount: number
}

interface OverflowListItem {
  key: string
  content: ReactNode
  measurementContent: ReactNode
}

export function OverflowList({
  items,
  getOverflowItem,
  getOverflowMeasurementItem,
  className,
  itemClassName,
}: {
  items: Array<OverflowListItem>
  /** Keep output deterministic for each hidden count; layout measurement reads the latest callback. */
  getOverflowItem: (hiddenCount: number) => ReactNode
  getOverflowMeasurementItem: (hiddenCount: number) => ReactNode
  className?: string
  itemClassName?: string
}) {
  const visibleListRef = useRef<HTMLDivElement | null>(null)
  const measurementListRef = useRef<HTMLDivElement | null>(null)
  const getOverflowItemRef = useRef(getOverflowItem)
  getOverflowItemRef.current = getOverflowItem
  const [layout, setLayout] = useState<OverflowListLayoutState>({
    visibleCount: items.length,
    hiddenCount: 0,
  })

  useLayoutEffect(() => {
    const visibleList = visibleListRef.current
    const measurementList = measurementListRef.current
    if (!visibleList || !measurementList) {
      return
    }

    const updateLayout = () => {
      const itemWidths = readMeasuredWidths(measurementList, 'data-overflow-list-item')
      if (itemWidths.length !== items.length) {
        return
      }
      const overflowWidths = readMeasuredWidthMap(measurementList, 'data-overflow-list-overflow')
      const nextLayout = getOverflowListLayout({
        containerWidth: visibleList.getBoundingClientRect().width,
        gapWidth: readColumnGap(visibleList),
        itemWidths,
        getOverflowItemWidth: (hiddenCount) => overflowWidths.get(hiddenCount) ?? 0,
      })
      setLayout((current) =>
        current.visibleCount === nextLayout.visibleCount &&
        current.hiddenCount === nextLayout.hiddenCount
          ? current
          : nextLayout,
      )
    }

    updateLayout()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateLayout)
      return () => window.removeEventListener('resize', updateLayout)
    }

    const observer = new ResizeObserver(updateLayout)
    observer.observe(visibleList)
    observer.observe(measurementList)
    return () => observer.disconnect()
  }, [className, getOverflowMeasurementItem, itemClassName, items])

  const visibleItems = items.slice(0, Math.min(layout.visibleCount, items.length))
  const safeHiddenCount = Math.min(
    Math.max(0, items.length - visibleItems.length),
    Math.max(0, layout.hiddenCount),
  )

  return (
    <div className="relative min-w-0">
      <div
        ref={visibleListRef}
        className={cn('flex min-w-0 flex-nowrap overflow-hidden', className)}
        data-overflow-list-visible=""
      >
        {visibleItems.map((item) => (
          <span key={item.key} className={itemClassName}>
            {item.content}
          </span>
        ))}
        {safeHiddenCount > 0 ? getOverflowItemRef.current(safeHiddenCount) : null}
      </div>
      <div
        ref={measurementListRef}
        aria-hidden="true"
        className={cn(
          className,
          'pointer-events-none invisible absolute top-0 left-0 -z-10 flex w-max max-w-none flex-nowrap overflow-visible whitespace-nowrap',
        )}
      >
        {items.map((item) => (
          <span key={item.key} className={itemClassName} data-overflow-list-item="">
            {item.measurementContent}
          </span>
        ))}
        {items.map((_, index) => {
          const hiddenCount = index + 1
          return (
            <span key={`overflow-${hiddenCount}`} data-overflow-list-overflow={hiddenCount}>
              {getOverflowMeasurementItem(hiddenCount)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function readMeasuredWidths(measurementList: HTMLElement, attributeName: string) {
  return [...measurementList.querySelectorAll<HTMLElement>(`[${attributeName}]`)].map(
    (element) => element.getBoundingClientRect().width,
  )
}

function readMeasuredWidthMap(measurementList: HTMLElement, attributeName: string) {
  const measuredWidths = new Map<number, number>()
  for (const element of measurementList.querySelectorAll<HTMLElement>(`[${attributeName}]`)) {
    const key = Number(element.getAttribute(attributeName))
    if (Number.isFinite(key)) {
      measuredWidths.set(key, element.getBoundingClientRect().width)
    }
  }
  return measuredWidths
}

function readColumnGap(element: HTMLElement) {
  const columnGap = Number.parseFloat(window.getComputedStyle(element).columnGap)
  return Number.isFinite(columnGap) ? columnGap : 0
}
