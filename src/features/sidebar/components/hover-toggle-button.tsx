import { cn } from '~/features/shadcn/lib/utils'

export interface HoverToggleButtonProps {
  nonHoverComponent?: React.ReactNode
  hoverComponent?: React.ReactNode
  className?: string
}

export function HoverToggleButton({
  nonHoverComponent,
  hoverComponent,
  className,
}: HoverToggleButtonProps) {
  return (
    <div className={cn(className, !nonHoverComponent && 'not-group-hover:w-0')}>
      <div
        data-testid="hover-toggle-default"
        className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0"
      >
        {nonHoverComponent}
      </div>
      <div
        data-testid="hover-toggle-hover"
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"
      >
        {hoverComponent}
      </div>
    </div>
  )
}
