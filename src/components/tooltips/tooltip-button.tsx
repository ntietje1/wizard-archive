import { Tooltip } from '@base-ui/react/tooltip'
import { TooltipContent, TooltipTrigger } from '~/components/shadcn/ui/tooltip'

export function TooltipButton({
  children,
  tooltip,
}: {
  children: React.ReactNode
  tooltip: string
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
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip.Root>
  )
}
