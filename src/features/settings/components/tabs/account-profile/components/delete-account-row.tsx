import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/features/shadcn/components/alert-dialog'
import { SettingsSubAlertDialogContent } from '~/features/settings/components/settings-sub-dialog'

function DeleteAccountDialogContent({ onDeletionEmailSent }: { onDeletionEmailSent: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setIsDeleting(true)
    setError('')
    try {
      await authClient.deleteUser({
        fetchOptions: {
          onSuccess: () => {
            setIsDeleting(false)
            setEmailSent(true)
            onDeletionEmailSent()
          },
          onError: (ctx) => {
            setIsDeleting(false)
            setError(ctx.error?.message || 'Failed to delete account')
          },
        },
      })
    } catch {
      setIsDeleting(false)
      setError('Unable to delete account. Please try again.')
    }
  }

  if (emailSent) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
            <Mail className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to confirm account deletion. Click the link in the email
              to permanently delete your account.
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Done</AlertDialogCancel>
        </AlertDialogFooter>
      </>
    )
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently delete your account and remove all of your data. This action cannot
          be undone. We'll send a verification email to confirm.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault()
            void handleDelete()
          }}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete account'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

export function DeleteAccountRow({ onDeletionEmailSent }: { onDeletionEmailSent: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-destructive">Delete account</p>
        <p className="text-sm text-destructive/70">Permanently delete your account and all data</p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        className="shrink-0"
        onClick={() => setShowConfirm(true)}
      >
        Delete account
      </Button>
      <AlertDialog open={showConfirm} onOpenChange={(open) => !open && setShowConfirm(false)}>
        <SettingsSubAlertDialogContent>
          {showConfirm && <DeleteAccountDialogContent onDeletionEmailSent={onDeletionEmailSent} />}
        </SettingsSubAlertDialogContent>
      </AlertDialog>
    </div>
  )
}
