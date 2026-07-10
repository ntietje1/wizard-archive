import { useReducer, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { USERNAME_MAX_LENGTH } from 'shared/users/constants'
import { getClientErrorMessage } from 'shared/errors/client'
import { normalizeUsernameInput, parseUsername, validateUsername } from 'shared/users/validation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { SettingsRow } from './settings-row'
import type { UserProfile } from 'shared/users/types'
import {
  useUpdateUsernameMutation,
  useUsernameExistsQuery,
} from '~/shared/hooks/use-user-profile-operations'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@wizard-archive/ui/shadcn/components/dialog'
import { SettingsSubDialogContent } from '~/features/settings/components/settings-sub-dialog'
import { useDebouncedValue } from '@wizard-archive/ui/hooks/use-debounced-value'

function useUsernameValidation(raw: string, currentUsername: string) {
  const normalizedUsername = normalizeUsernameInput(raw)
  const isUnchanged = normalizedUsername === currentUsername

  const localError = validateUsername(normalizedUsername)

  const shouldCheckRemote = !localError && !isUnchanged
  const debouncedUsername = useDebouncedValue(shouldCheckRemote ? normalizedUsername : '', 300)
  const isWaitingForDebounce = shouldCheckRemote && debouncedUsername !== normalizedUsername
  const parsedDebouncedUsername = debouncedUsername ? parseUsername(debouncedUsername) : null

  const existsQuery = useUsernameExistsQuery(parsedDebouncedUsername)

  const isTaken = existsQuery.data === true
  const isChecking = shouldCheckRemote && (isWaitingForDebounce || existsQuery.isLoading)

  const error = localError ?? (isTaken ? 'Username is already taken' : null)
  const canSubmit = !error && !isUnchanged && !isChecking

  return { normalizedUsername, error, canSubmit, isChecking }
}

function UsernameChangeDialog({ profile, onClose }: { profile: UserProfile; onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [state, updateState] = useReducer(
    (
      current: { username: string; isLoading: boolean; submitError: string },
      patch: Partial<{ username: string; isLoading: boolean; submitError: string }>,
    ) => ({ ...current, ...patch }),
    { username: profile.username, isLoading: false, submitError: '' },
  )

  const {
    normalizedUsername,
    error: validationError,
    canSubmit,
    isChecking,
  } = useUsernameValidation(state.username, profile.username)

  const updateUsername = useUpdateUsernameMutation()

  const handleSave = async () => {
    if (!canSubmit) return
    updateState({ submitError: '', isLoading: true })
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
      updateState({
        submitError:
          getClientErrorMessage(error) ??
          (error instanceof Error ? error.message : 'Failed to update username'),
      })
    }
    updateState({ isLoading: false })
  }

  const displayError = validationError ?? state.submitError

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
            value={state.username}
            onChange={(e) => updateState({ username: e.target.value })}
            disabled={state.isLoading}
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
            Lowercase letters, numbers, hyphens, and underscores only. Must be unique.
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
        <Button onClick={handleSave} disabled={!canSubmit || state.isLoading}>
          {state.isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
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
