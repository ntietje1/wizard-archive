import type { ComponentProps, Ref } from 'react'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { cn } from '~/features/shadcn/lib/utils'

export function ValueInlineChip({
  slug,
  displayedValue,
  hasError,
  isLoading = false,
  valueId,
  valueInstanceId,
  state,
  spanRef,
  className,
  children,
  draggable = false,
  ...props
}: {
  slug: string
  displayedValue: string
  hasError: boolean
  isLoading?: boolean
  valueId?: string
  valueInstanceId?: string
  state?: string
  spanRef?: Ref<HTMLSpanElement>
} & ComponentProps<'span'>) {
  return (
    <span
      ref={spanRef}
      className={cn(
        'inline-flex max-w-full cursor-pointer items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium align-baseline focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:outline-none',
        hasError && 'border-destructive/40 bg-destructive/10 text-destructive',
        className,
      )}
      data-testid="note-value-inline"
      data-note-value-id={valueId}
      data-note-value-instance-id={valueInstanceId}
      data-note-value-slug={slug}
      data-note-value-state={state}
      draggable={draggable}
      {...props}
    >
      {children ?? (
        <>
          <span className="truncate">{slug || 'value'}</span>
          {hasError ? (
            <AlertTriangle aria-label="Value error" className="size-3 shrink-0" />
          ) : isLoading ? (
            <LoaderCircle aria-label="Value loading" className="size-3 shrink-0 animate-spin" />
          ) : (
            <span className="truncate text-muted-foreground">{displayedValue}</span>
          )}
        </>
      )}
    </span>
  )
}
