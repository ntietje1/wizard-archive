import { useReducer } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { AuthFormShell, AuthPasswordField, AuthStatusMessage } from './auth-form-elements'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '@wizard-archive/ui/shadcn/components/button'

type ResetState = {
  newPassword: string
  confirmPassword: string
  isLoading: boolean
  error: string
  success: boolean
}

type ResetAction =
  | {
      type: 'SET_FIELD'
      field: 'newPassword' | 'confirmPassword'
      value: string
    }
  | { type: 'SUBMIT' }
  | { type: 'ERROR'; error: string }
  | { type: 'SUCCESS' }
  | { type: 'DONE' }

function resetReducer(state: ResetState, action: ResetAction): ResetState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'SUBMIT':
      return { ...state, error: '', isLoading: true }
    case 'ERROR':
      return { ...state, error: action.error }
    case 'SUCCESS':
      return { ...state, newPassword: '', confirmPassword: '', success: true }
    case 'DONE':
      return { ...state, isLoading: false }
  }
}

const initialResetState: ResetState = {
  newPassword: '',
  confirmPassword: '',
  isLoading: false,
  error: '',
  success: false,
}

export function ResetPasswordForm() {
  const { token } = useSearch({ strict: false })
  const [state, dispatch] = useReducer(resetReducer, initialResetState)
  const { newPassword, confirmPassword, isLoading, error, success } = state

  if (!token) {
    return (
      <AuthStatusMessage
        title="Invalid link"
        linkTo="/forgot-password"
        linkLabel="Request a new link"
      >
        This password reset link is invalid or has expired.
      </AuthStatusMessage>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      dispatch({ type: 'ERROR', error: 'Passwords do not match' })
      return
    }

    if (newPassword.length < 8) {
      dispatch({
        type: 'ERROR',
        error: 'Password must be at least 8 characters',
      })
      return
    }

    dispatch({ type: 'SUBMIT' })

    await authClient
      .resetPassword(
        { newPassword, token },
        {
          onSuccess: () => {
            dispatch({ type: 'SUCCESS' })
          },
          onError: (ctx) => {
            dispatch({
              type: 'ERROR',
              error: ctx.error.message || 'Failed to reset password',
            })
          },
        },
      )
      .catch(() => {
        dispatch({
          type: 'ERROR',
          error: 'An unexpected error occurred. Please try again.',
        })
      })
      .finally(() => {
        dispatch({ type: 'DONE' })
      })
  }

  if (success) {
    return (
      <AuthStatusMessage
        title="Password reset"
        linkTo="/sign-in"
        linkLabel="Sign in with your new password"
      >
        Your password has been reset successfully.
      </AuthStatusMessage>
    )
  }

  return (
    <AuthFormShell title="Reset password" description="Enter your new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthPasswordField
          id="new-password"
          label="New password"
          placeholder="Enter new password"
          value={newPassword}
          onValueChange={(value) =>
            dispatch({
              type: 'SET_FIELD',
              field: 'newPassword',
              value,
            })
          }
          disabled={isLoading}
          minLength={8}
          autoComplete="new-password"
        />
        <AuthPasswordField
          id="confirm-password"
          label="Confirm password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onValueChange={(value) =>
            dispatch({
              type: 'SET_FIELD',
              field: 'confirmPassword',
              value,
            })
          }
          disabled={isLoading}
          minLength={8}
          autoComplete="new-password"
        />

        {error && (
          <p className="text-sm text-destructive text-center" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Resetting...</span>
            </>
          ) : (
            'Reset password'
          )}
        </Button>
      </form>
    </AuthFormShell>
  )
}
