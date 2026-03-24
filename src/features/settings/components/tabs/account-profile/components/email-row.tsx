import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { validateEmail } from 'convex/users/validation'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from 'convex/users/types'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { Label } from '~/features/shadcn/components/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/features/shadcn/components/tooltip'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/features/shadcn/components/dialog'
import { SettingsSubDialogContent } from '~/features/settings/components/settings-sub-dialog'

function useOAuthProvider() {
  const query = useQuery({
    queryKey: ['auth', 'oauthProvider'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await authClient.listAccounts()
      if (error || !data) throw new Error('Failed to load accounts')
      const oauth = data.find(
        (a: { providerId: string }) => a.providerId !== 'credential',
      )
      return oauth?.providerId ?? null
    },
    staleTime: Infinity,
  })
  if (query.isLoading || query.isError) return undefined
  return query.data ?? null
}

export function EmailRow({ profile }: { profile: UserProfile }) {
  const [isEditing, setIsEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const oauthProvider = useOAuthProvider()

  const trimmedEmail = newEmail.trim()
  const emailError = trimmedEmail ? validateEmail(trimmedEmail) : null
  const isUnchanged = trimmedEmail === profile.email
  const canSubmit = !emailError && !isUnchanged && !!trimmedEmail && !isLoading

  useEffect(() => {
    if (sentTo && profile.email === sentTo) {
      toast.success('Email changed successfully')
      setSentTo('')
      setIsEditing(false)
    }
  }, [profile.email, sentTo])

  const handleSave = async () => {
    if (!canSubmit) return
    setError('')
    setIsLoading(true)
    try {
      await authClient.changeEmail({
        newEmail: newEmail.trim(),
        callbackURL: '/',
      })
      setSentTo(newEmail.trim())
      setNewEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change email')
    }
    setIsLoading(false)
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      setIsEditing(false)
      setSentTo('')
      setNewEmail('')
      setError('')
    }
  }

  const isLoaded = oauthProvider !== undefined
  const isManagedByOAuth = !!oauthProvider
  const providerLabel = oauthProvider
    ? oauthProvider.charAt(0).toUpperCase() + oauthProvider.slice(1)
    : ''

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Email</p>
        <p className="text-sm text-muted-foreground truncate">
          {profile.email ?? 'Not set'}
        </p>
      </div>
      {isManagedByOAuth ? (
        <Tooltip>
          <TooltipTrigger className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled
              tabIndex={-1}
              className="pointer-events-none"
            >
              Change email
            </Button>
          </TooltipTrigger>
          <TooltipContent>Managed by {providerLabel}</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!isLoaded}
          onClick={() => {
            setNewEmail('')
            setSentTo('')
            setError('')
            setIsEditing(true)
          }}
        >
          Change email
        </Button>
      )}
      <Dialog open={isEditing} onOpenChange={handleClose}>
        <SettingsSubDialogContent>
          {sentTo ? (
            <>
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    Check your new email inbox
                  </p>
                  <p className="text-sm text-muted-foreground">
                    We sent a verification link to{' '}
                    <strong className="text-foreground">{sentTo}</strong>. Click
                    the link to complete the change.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Change email</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-email">New email address</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                {newEmail.trim() && emailError ? (
                  <p className="text-xs text-destructive">{emailError}</p>
                ) : error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : null}
              </div>
              <DialogFooter showCloseButton>
                <Button onClick={handleSave} disabled={!canSubmit}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </SettingsSubDialogContent>
      </Dialog>
    </div>
  )
}
