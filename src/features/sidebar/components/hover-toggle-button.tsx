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
      {' '}
      {/* free up width when not not hovering and no non-hovercomponent*/}
      <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 group-hover:transition-opacity">
        {nonHoverComponent}
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:transition-opacity">
        {hoverComponent}
      </div>
    </div>
  )
}
