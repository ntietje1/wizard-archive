import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { SettingsRow } from './settings-row'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { Label } from '~/features/shadcn/components/label'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/features/shadcn/components/dialog'
import { SettingsSubDialogContent } from '~/features/settings/components/settings-sub-dialog'

function PasswordChangeDialog({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    try {
      await authClient.changePassword(
        { currentPassword, newPassword },
        {
          onSuccess: () => {
            toast.success('Password changed')
            onClose()
          },
          onError: (ctx) => {
            setError(ctx.error.message || 'Failed to change password')
            setIsLoading(false)
          },
        },
      )
    } catch {
      setError('Unable to change password. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change password</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        Passwords must be at least 8 characters long. We recommend using a mix of letters, numbers,
        and symbols.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isLoading}
            minLength={8}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter showCloseButton>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Change password'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function PasswordRow() {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <SettingsRow
      label="Password"
      value="Change your account password"
      buttonLabel="Change password"
      onAction={() => setIsEditing(true)}
    >
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <SettingsSubDialogContent>
          {isEditing && <PasswordChangeDialog onClose={() => setIsEditing(false)} />}
        </SettingsSubDialogContent>
      </Dialog>
    </SettingsRow>
  )
}
