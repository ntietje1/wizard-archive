import { cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { mergeProps } from '@base-ui/react/merge-props'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

export function TooltipButton({
  children,
  tooltip,
  side = 'right',
}: {
  children: ReactNode
  tooltip: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => {
          if (isValidElement<{ className?: string }>(children)) {
            const child = children as ReactElement<{ className?: string }>
            return cloneElement(child, {
              ...mergeProps(child.props, props),
              className: cn(child.props.className, props.className),
            })
          }

          return (
            <span {...props} className={cn('inline-flex', props.className)}>
              {children}
            </span>
          )
        }}
      />
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
