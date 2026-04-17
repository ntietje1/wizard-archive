import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { USERNAME_MAX_LENGTH } from 'convex/users/constants'
import { getClientErrorMessage } from 'convex/errors'
import { normalizeUsernameInput, parseUsername, validateUsername } from 'convex/users/validation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { SettingsRow } from './settings-row'
import type { UserProfile } from 'convex/users/types'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
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

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function useUsernameValidation(raw: string, currentUsername: string) {
  const normalizedUsername = normalizeUsernameInput(raw)
  const isUnchanged = normalizedUsername === currentUsername

  const localError = validateUsername(normalizedUsername)

  const shouldCheckRemote = !localError && !isUnchanged
  const debouncedUsername = useDebouncedValue(shouldCheckRemote ? normalizedUsername : '', 300)
  const isWaitingForDebounce = shouldCheckRemote && debouncedUsername !== normalizedUsername
  const parsedDebouncedUsername = debouncedUsername ? parseUsername(debouncedUsername) : null

  const existsQuery = useAuthQuery(
    api.users.queries.checkUsernameExists,
    parsedDebouncedUsername ? { username: parsedDebouncedUsername } : 'skip',
  )

  const isTaken = existsQuery.data === true
  const isChecking = shouldCheckRemote && (isWaitingForDebounce || existsQuery.isLoading)

  const error = localError ?? (isTaken ? 'Username is already taken' : null)
  const canSubmit = !error && !isUnchanged && !isChecking

  return { normalizedUsername, error, canSubmit, isChecking }
}

function UsernameChangeDialog({ profile, onClose }: { profile: UserProfile; onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState<string>(profile.username)
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const {
    normalizedUsername,
    error: validationError,
    canSubmit,
    isChecking,
  } = useUsernameValidation(username, profile.username)

  const updateUsername = useAppMutation(api.users.mutations.updateUsername)

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitError('')
    setIsLoading(true)
    try {
      const newUsername = await updateUsername.mutateAsync({
        username: normalizedUsername,
      })
      toast.success('Username updated')
      onClose()

      const oldPrefix = `/campaigns/${profile.username}/`
      if (location.pathname.startsWith(oldPrefix)) {
        const rest = location.pathname.slice(oldPrefix.length)
        void navigate({
          to: `/campaigns/${newUsername}/${rest}`,
          replace: true,
        })
      }
    } catch (error) {
      setSubmitError(
        getClientErrorMessage(error) ??
          (error instanceof Error ? error.message : 'Failed to update username'),
      )
    }
    setIsLoading(false)
  }

  const displayError = validationError ?? submitError

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change username</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-username">Username</Label>
        <div className="relative">
          <Input
            id="edit-username"
            value={username}
            onChange={(e) => setUsername(normalizeUsernameInput(e.target.value))}
            disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="pr-8"
            maxLength={USERNAME_MAX_LENGTH}
          />
          {isChecking && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        {displayError ? (
          <p className="text-xs text-destructive">{displayError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens only. Must be unique.
          </p>
        )}
      </div>
      <div className="flex items-start gap-2 rounded-md bg-accent p-3">
        <AlertTriangle className="size-4 shrink-0 text-muted-foreground mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Changing your username will update the URL for all campaigns you own. Any shared links
          using your old username will stop working.
        </p>
      </div>
      <DialogFooter showCloseButton>
        <Button onClick={handleSave} disabled={!canSubmit || isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function UsernameRow({ profile }: { profile: UserProfile }) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <SettingsRow
      label="Username"
      value={`@${profile.username}`}
      buttonLabel="Change username"
      onAction={() => setIsEditing(true)}
    >
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <SettingsSubDialogContent>
          {isEditing && (
            <UsernameChangeDialog profile={profile} onClose={() => setIsEditing(false)} />
          )}
        </SettingsSubDialogContent>
      </Dialog>
    </SettingsRow>
  )
}
