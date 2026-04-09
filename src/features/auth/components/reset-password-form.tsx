import { useReducer } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { Label } from '~/features/shadcn/components/label'

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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Invalid link</h1>
          <p className="text-sm text-muted-foreground text-balance">
            This password reset link is invalid or has expired.
          </p>
        </div>
        <Link
          to="/forgot-password"
          className="text-sm text-primary underline-offset-4 hover:underline font-medium flex justify-center"
        >
          Request a new link
        </Link>
      </div>
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Password reset</h1>
          <p className="text-sm text-muted-foreground text-balance">
            Your password has been reset successfully.
          </p>
        </div>
        <Link
          to="/sign-in"
          className="text-sm text-primary underline-offset-4 hover:underline font-medium flex justify-center"
        >
          Sign in with your new password
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="text-sm text-muted-foreground text-balance">Enter your new password</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) =>
              dispatch({
                type: 'SET_FIELD',
                field: 'newPassword',
                value: e.target.value,
              })
            }
            required
            disabled={isLoading}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) =>
              dispatch({
                type: 'SET_FIELD',
                field: 'confirmPassword',
                value: e.target.value,
              })
            }
            required
            disabled={isLoading}
            minLength={8}
            autoComplete="new-password"
          />
        </div>

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
    </div>
  )
}
