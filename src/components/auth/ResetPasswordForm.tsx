import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { Button } from '~/components/shadcn/ui/button'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Loader2 } from '~/lib/icons'

export function ResetPasswordForm() {
  const { token } = useSearch({ strict: false })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    await authClient
      .resetPassword(
        { newPassword, token },
        {
          onSuccess: () => {
            setSuccess(true)
          },
          onError: (ctx) => {
            setError(ctx.error.message || 'Failed to reset password')
          },
        },
      )
      .catch(() => {
        setError('An unexpected error occured. Please try again.')
      })
      .finally(() => {
        setIsLoading(false)
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
        <p className="text-sm text-muted-foreground text-balance">
          Enter your new password
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Reset password'
          )}
        </Button>
      </form>
    </div>
  )
}
