import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { Button, buttonVariants } from '~/components/shadcn/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/shadcn/ui/card'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Separator } from '~/components/shadcn/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/shadcn/ui/alert-dialog'
import { EnableTwoFactor } from '~/components/auth/EnableTwoFactor'
import { Loader2 } from '~/lib/icons'

export function Settings() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      <ChangePasswordSection />
      <Separator />
      <TwoFactorSection />
      <Separator />
      <DeleteAccountSection />
    </div>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    await authClient.changePassword(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setSuccess('Password changed successfully')
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
          setIsLoading(false)
        },
        onError: (ctx) => {
          setError(ctx.error.message || 'Failed to change password')
          setIsLoading(false)
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Change Password</CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-new-password">New password</Label>
            <Input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-confirm-password">Confirm new password</Label>
            <Input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <Button type="submit" className="w-fit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Change password'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function TwoFactorSection() {
  const session = authClient.useSession()
  const [showEnable, setShowEnable] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [error, setError] = useState('')

  const isTwoFactorEnabled = session.data?.user?.twoFactorEnabled ?? false

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsDisabling(true)

    const { error: err } = await authClient.twoFactor.disable({
      password: disablePassword,
    })

    if (err) {
      setError(err.message || 'Failed to disable 2FA')
      setIsDisabling(false)
      return
    }

    setShowDisableForm(false)
    setDisablePassword('')
    setIsDisabling(false)
    session.refetch()
  }

  if (showEnable) {
    return (
      <EnableTwoFactor
        onComplete={() => {
          setShowEnable(false)
          session.refetch()
        }}
        onCancel={() => setShowEnable(false)}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
        <CardDescription>
          {isTwoFactorEnabled
            ? 'Two-factor authentication is enabled on your account'
            : 'Add an extra layer of security to your account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isTwoFactorEnabled ? (
          <>
            {showDisableForm ? (
              <form onSubmit={handleDisable} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="disable-2fa-password">
                    Enter your password to disable 2FA
                  </Label>
                  <Input
                    id="disable-2fa-password"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                    disabled={isDisabling}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDisableForm(false)
                      setDisablePassword('')
                      setError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isDisabling}
                  >
                    {isDisabling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Disable 2FA'
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="destructive"
                className="w-fit"
                onClick={() => setShowDisableForm(true)}
              >
                Disable 2FA
              </Button>
            )}
          </>
        ) : (
          <Button className="w-fit" onClick={() => setShowEnable(true)}>
            Enable 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function DeleteAccountSection() {
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    await authClient.deleteUser({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: '/' })
        },
        onError: () => {
          setIsDeleting(false)
        },
      },
    })
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-lg text-destructive">Delete Account</CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <button className={buttonVariants({ variant: 'destructive' })} disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Delete account'
                )}
              </button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and remove all of your data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
