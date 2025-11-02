import { AlertCircle } from 'lucide-react'

interface ErrorAlertProps {
  error?: string | Error
  shouldShowError: boolean
}

const getErrorMessage = (error: string | Error | undefined): string => {
  if (!error) return 'An error occurred'
  if (typeof error === 'string') return error
  return 'Something went wrong. Please try again.'
}

export const ErrorAlert = ({ error, shouldShowError }: ErrorAlertProps) => {
  return shouldShowError ? (
    <p className="text-sm text-red-500 flex items-center gap-1 flex-1">
      <AlertCircle size={14} />
      {getErrorMessage(error)}
    </p>
  ) : null
}

interface ErrorAlertAndCharacterCountProps extends ErrorAlertProps {
  characterCount: number
  maxCharCount: number
}

export const ErrorAlertAndCharacterCount = ({
  error,
  shouldShowError,
  characterCount,
  maxCharCount,
}: ErrorAlertAndCharacterCountProps) => {
  return (
    <div className="flex items-center justify-end gap-2">
      {shouldShowError ? (
        <p className="text-sm text-red-500 flex items-center gap-1 flex-1">
          <AlertCircle size={14} />
          {getErrorMessage(error)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {characterCount}/{maxCharCount}
        </p>
      )}
    </div>
  )
}
