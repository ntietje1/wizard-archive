import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { SettingsRow } from './settings-row'
import type { UserProfile } from 'convex/users/types'
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

function DisableTwoFactorDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [isDisabling, setIsDisabling] = useState(false)
  const [error, setError] = useState('')

  const handleDisable = async () => {
    setError('')
    setIsDisabling(true)

    try {
      const { error: err } = await authClient.twoFactor.disable({
        password,
      })

      if (err) {
        setError(err.message || 'Failed to disable 2FA')
        setIsDisabling(false)
        return
      }

      toast.success('Two-factor authentication disabled')
      onClose()
    } catch {
      setError('Unable to disable 2FA. Please try again.')
      setIsDisabling(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Disable two-factor authentication</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="disable-2fa-password">
          Enter your password to confirm
        </Label>
        <Input
          id="disable-2fa-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isDisabling}
          onKeyDown={(e) => e.key === 'Enter' && handleDisable()}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter showCloseButton>
        <Button
          variant="destructive"
          onClick={handleDisable}
          disabled={isDisabling}
        >
          {isDisabling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Disable 2FA'
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

export function TwoFactorRow({ profile }: { profile: UserProfile }) {
  const isTwoFactorEnabled = profile.twoFactorEnabled ?? false
  const [showDisableDialog, setShowDisableDialog] = useState(false)

  return (
    <SettingsRow
      label="Two-factor authentication"
      value={
        isTwoFactorEnabled
          ? 'Enabled — your account has extra security'
          : 'Add an extra layer of security to your account'
      }
      buttonLabel={isTwoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
      buttonVariant={isTwoFactorEnabled ? 'destructive' : 'default'}
      onAction={() => {
        if (isTwoFactorEnabled) {
          setShowDisableDialog(true)
        } else {
          toast.info('2FA setup coming soon')
        }
      }}
    >
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <SettingsSubDialogContent>
          {showDisableDialog && (
            <DisableTwoFactorDialog
              onClose={() => setShowDisableDialog(false)}
            />
          )}
        </SettingsSubDialogContent>
      </Dialog>
    </SettingsRow>
  )
}
