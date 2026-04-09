import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'

export function TooltipButton({
  children,
  tooltip,
  side = 'right',
}: {
  children: React.ReactNode
  tooltip: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <span {...props} className="inline-flex">
            {children}
          </span>
        )}
      />
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
