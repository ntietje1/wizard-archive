import { AlertCircle } from 'lucide-react'

interface ErrorAlertProps {
  error?: string
  shouldShowError: boolean
}
export const ErrorAlert = ({ error, shouldShowError }: ErrorAlertProps) => {
  return shouldShowError ? (
    <p className="text-sm text-red-500 flex items-center gap-1 flex-1">
      <AlertCircle size={14} />
      {error || 'An error occurred'}
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
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {characterCount}/{maxCharCount}
        </p>
      )}
    </div>
  )
}
