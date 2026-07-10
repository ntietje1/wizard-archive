import * as React from 'react'

import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input bg-control-surface focus-visible:border-ring focus-visible:ring-control-focus-ring aria-invalid:ring-control-invalid-ring aria-invalid:border-control-invalid-border disabled:bg-control-disabled rounded-lg border px-2.5 py-2 text-base focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
