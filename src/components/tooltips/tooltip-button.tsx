import { Tooltip } from '@base-ui/react/tooltip'
import { TooltipContent, TooltipTrigger } from '~/components/shadcn/ui/tooltip'

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
    <Tooltip.Root>
      <TooltipTrigger
        render={(props) => (
          <span {...props} className="inline-flex">
            {children}
          </span>
        )}
      />
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip.Root>
  )
}
