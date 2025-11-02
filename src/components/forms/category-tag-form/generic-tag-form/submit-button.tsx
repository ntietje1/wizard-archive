import { Button } from '~/components/shadcn/ui/button'

export function SubmitButton({
  mode,
  isSubmitting,
  isDisabled,
}: {
  mode: 'create' | 'edit'
  isSubmitting: boolean
  isDisabled: boolean
}) {
  return (
    <Button type="submit" disabled={isSubmitting || isDisabled}>
      {isSubmitting ? (
        <>
          <>
            <span className="sr-only">Loading</span>
            <div
              aria-hidden="true"
              className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground"
            />
          </>{' '}
          {mode === 'create' ? 'Creating...' : 'Updating...'}
        </>
      ) : mode === 'create' ? (
        'Create'
      ) : (
        'Update'
      )}
    </Button>
  )
}
