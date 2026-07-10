import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { toggleVariants } from '@wizard-archive/ui/shadcn/components/toggle-variants'

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle }
