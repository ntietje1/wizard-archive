import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

interface NameValidationFeedbackProps {
  errorMessage?: string
  className?: string
  id?: string
}

export function NameValidationFeedback({
  errorMessage,
  className,
  id,
}: NameValidationFeedbackProps) {
  if (!errorMessage) {
    return null
  }

  return (
    <div
      id={id}
      role="alert"
      className={cn(
        'absolute left-0 top-full mt-1 z-50',
        'flex items-center gap-1.5 px-2 py-1',
        'text-xs text-destructive-foreground bg-destructive rounded-md shadow-md',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-105 duration-100',
        className,
      )}
    >
      <span>{errorMessage}</span>
    </div>
  )
}
