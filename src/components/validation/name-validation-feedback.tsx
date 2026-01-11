import { cn } from '~/lib/shadcn/utils'
import { Spinner } from '~/components/shadcn/ui/spinner'

interface NameValidationFeedbackProps {
  isLoading: boolean
  isNotUnique: boolean
  shouldValidate: boolean
  className?: string
}

/**
 * Obsidian-style inline validation feedback component.
 * Shows automatically (not on hover) when validation state changes.
 * - Shows a spinner while validation is loading
 * - Shows "Name already exists" error when name is taken
 */
export function NameValidationFeedback({
  isLoading,
  isNotUnique,
  shouldValidate,
  className,
}: NameValidationFeedbackProps) {
  // Don't show anything if we're not validating
  if (!shouldValidate) {
    return null
  }

  // Show loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          'absolute left-0 top-full mt-1 z-50',
          'flex items-center gap-1.5 px-2 py-1',
          'text-xs text-muted-foreground bg-muted border border-border rounded-md shadow-sm',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          className,
        )}
      >
        <Spinner className="size-3" />
        <span>Checking...</span>
      </div>
    )
  }

  // Show error state
  if (isNotUnique) {
    return (
      <div
        className={cn(
          'absolute left-0 top-full mt-1 z-50',
          'flex items-center gap-1.5 px-2 py-1',
          'text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md shadow-sm',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          className,
        )}
      >
        <span>Name already exists here</span>
      </div>
    )
  }

  return null
}

interface FormFieldValidationProps {
  isLoading: boolean
  isNotUnique: boolean
  shouldValidate: boolean
  className?: string
}

/**
 * Validation feedback for form fields (shown below the input, not positioned absolutely)
 */
export function FormFieldValidation({
  isLoading,
  isNotUnique,
  shouldValidate,
  className,
}: FormFieldValidationProps) {
  // Don't show anything if we're not validating
  if (!shouldValidate) {
    return null
  }

  // Show loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 mt-1',
          'text-xs text-muted-foreground',
          'animate-in fade-in-0 duration-150',
          className,
        )}
      >
        <Spinner className="size-3" />
        <span>Checking name availability...</span>
      </div>
    )
  }

  // Show error state
  if (isNotUnique) {
    return (
      <p
        className={cn(
          'text-sm text-destructive mt-1',
          'animate-in fade-in-0 duration-150',
          className,
        )}
      >
        A name with this value already exists here
      </p>
    )
  }

  return null
}
