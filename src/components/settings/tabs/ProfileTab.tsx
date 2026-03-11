import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { debounce } from 'lodash-es'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { authClient } from '~/lib/auth-client'
import { Button } from '~/components/shadcn/ui/button'
import { Input } from '~/components/shadcn/ui/input'
import { Separator } from '~/components/shadcn/ui/separator'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/shadcn/ui/alert-dialog'
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/shadcn/ui/dialog'
import {
  SettingsSubAlertDialog,
  SettingsSubAlertDialogContent,
  SettingsSubDialog,
  SettingsSubDialogContent,
} from '~/components/settings/SettingsSubDialog'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/components/shadcn/ui/avatar'
import { Label } from '~/components/shadcn/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'
import {
  Camera,
  CheckIcon,
  Copy,
  Loader2,
  Mail,
  Monitor,
  Smartphone,
  Tablet,
} from '~/lib/icons'
import { useActiveSessions } from '~/hooks/useAuthSessions'
import { useAuthQuery } from '~/hooks/useAuthQuery'
import { useFileUpload } from '~/hooks/useFileUpload'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/shadcn/ui/table'
import { cn } from '~/lib/shadcn/utils'

type Profile = NonNullable<
  ReturnType<
    typeof useAuthQuery<typeof api.users.queries.getUserProfile>
  >['data']
>

function getInitials(name?: string, email?: string): string {
  if (name) {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    if (initials) return initials
  }
  if (email) return email[0].toUpperCase()
  return 'U'
}

export function ProfileTab() {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
          Account
        </p>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and account security
        </p>
      </div>

      {profileQuery.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {profileQuery.isError && (
        <p className="text-sm text-destructive">Failed to load profile</p>
      )}

      {profile && (
        <>
          {/* Account section */}
          <SettingsSection title="Account">
            <AccountRow profile={profile} />
            <Separator />
            <UsernameRow profile={profile} />
          </SettingsSection>

          {/* Account security section */}
          <SettingsSection title="Account security">
            <EmailRow profile={profile} />
            <Separator />
            <PasswordRow />
            <Separator />
            <TwoFactorRow />
            <Separator />
            <DeleteAccountRow />
          </SettingsSection>

          {/* Active sessions section */}
          <ActiveSessionsSection />

          {/* User ID section */}
          <SettingsSection title="User ID">
            <UserIdRow userId={profile._id} />
          </SettingsSection>
        </>
      )}
    </div>
  )
}

// --- Section wrapper ---

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  )
}

// --- Shared Row Layout ---

function SettingsRow({
  label,
  value,
  buttonLabel,
  buttonVariant: variant = 'outline',
  onAction,
  children,
}: {
  label: string
  value: string
  buttonLabel: string
  buttonVariant?: 'outline' | 'default' | 'destructive'
  onAction: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground truncate">{value}</p>
      </div>
      <Button
        variant={variant}
        size="sm"
        onClick={onAction}
        className="shrink-0"
      >
        {buttonLabel}
      </Button>
      {children}
    </div>
  )
}
// --- Account (avatar + preferred name) ---

function AccountRow({ profile }: { profile: Profile }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadFile, commitUpload } = useFileUpload()
  const [isUploading, setIsUploading] = useState(false)
  const [name, setName] = useState(profile.name ?? '')

  const updateProfileImage = useMutation({
    mutationFn: useConvexMutation(api.users.mutations.updateProfileImage),
  })

  const updateNameMutation = useMutation({
    mutationFn: useConvexMutation(api.users.mutations.updateName),
  })

  const debouncedSaveName = useMemo(
    () =>
      debounce(async (value: string) => {
        const trimmed = value.trim()
        if (!trimmed) return
        try {
          await updateNameMutation.mutateAsync({ name: trimmed })
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to update name',
          )
        }
      }, 500),
    [updateNameMutation],
  )

  useEffect(() => {
    return () => {
      debouncedSaveName.cancel()
    }
  }, [debouncedSaveName])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    debouncedSaveName(e.target.value)
  }

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB')
        return
      }

      setIsUploading(true)
      try {
        const storageId = await uploadFile.mutateAsync(file)
        await commitUpload.mutateAsync({ storageId })
        await updateProfileImage.mutateAsync({ storageId })
        toast.success('Profile picture updated')
      } catch {
        toast.error('Failed to upload image')
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [uploadFile, commitUpload, updateProfileImage],
  )

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="relative group rounded-full cursor-pointer shrink-0"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <Avatar className="!size-12">
          {profile.imageUrl && (
            <AvatarImage src={profile.imageUrl} alt={profile.name ?? ''} />
          )}
          <AvatarFallback>
            {getInitials(profile.name, profile.email)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {isUploading ? (
            <Loader2 className="size-4 text-white animate-spin" />
          ) : (
            <Camera className="size-4 text-white" />
          )}
        </div>
      </button>
      <div className="min-w-0 flex flex-col gap-1 max-w-56">
        <Label
          htmlFor="preferred-name"
          className="text-xs text-muted-foreground"
        >
          Preferred name
        </Label>
        <Input
          id="preferred-name"
          value={name}
          onChange={handleNameChange}
          placeholder="Your preferred name"
          className="h-8 text-sm"
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}

// --- Username ---

function UsernameRow({ profile }: { profile: Profile }) {
  const [isEditing, setIsEditing] = useState(false)
  const [username, setUsername] = useState(profile.username)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const updateUsername = useMutation({
    mutationFn: useConvexMutation(api.users.mutations.updateUsername),
  })

  const handleSave = async () => {
    const trimmed = username.trim().toLowerCase()
    if (!trimmed || trimmed.length < 2) {
      setError('Username must be at least 2 characters')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      await updateUsername.mutateAsync({ username: trimmed })
      toast.success('Username updated')
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update username')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SettingsRow
      label="Username"
      value={`@${profile.username}`}
      buttonLabel="Change username"
      onAction={() => {
        setUsername(profile.username)
        setError('')
        setIsEditing(true)
      }}
    >
      <SettingsSubDialog open={isEditing} onOpenChange={setIsEditing}>
        <SettingsSubDialogContent>
          <DialogHeader>
            <DialogTitle>Change username</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-username">Username</Label>
            <Input
              id="edit-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only. Must be unique.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </SettingsSubDialogContent>
      </SettingsSubDialog>
    </SettingsRow>
  )
}

// --- Email ---

function useOAuthProvider() {
  const [provider, setProvider] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    authClient
      .listAccounts()
      .then(({ data }) => {
        const oauth = data?.find((a) => a.providerId !== 'credential')
        setProvider(oauth?.providerId ?? null)
      })
      .catch(() => {
        setProvider(null)
      })
  }, [])

  return provider
}
function EmailRow({ profile }: { profile: Profile }) {
  const [isEditing, setIsEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const oauthProvider = useOAuthProvider()

  const handleSave = async () => {
    setError('')
    if (!newEmail.trim()) {
      setError('Email cannot be empty')
      return
    }
    setIsLoading(true)
    try {
      await authClient.changeEmail({
        newEmail: newEmail.trim(),
        callbackURL: '/settings',
      })
      setSentTo(newEmail.trim())
      setNewEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change email')
    } finally {
      setIsLoading(false)
    }
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
      <SettingsSubDialog open={isEditing} onOpenChange={handleClose}>
        <SettingsSubDialogContent>
          {sentTo ? (
            <>
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
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
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter showCloseButton>
                <Button onClick={handleSave} disabled={isLoading}>
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
      </SettingsSubDialog>
    </div>
  )
}

// --- Password ---

function PasswordRow() {
  const [isEditing, setIsEditing] = useState(false)
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
    await authClient.changePassword(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed')
          setIsEditing(false)
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
    <SettingsRow
      label="Password"
      value="Change your account password"
      buttonLabel="Change password"
      onAction={() => {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setError('')
        setIsEditing(true)
      }}
    >
      <SettingsSubDialog open={isEditing} onOpenChange={setIsEditing}>
        <SettingsSubDialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Passwords must be at least 8 characters long. We recommend using a
            mix of letters, numbers, and symbols.
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
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Change password'
              )}
            </Button>
          </DialogFooter>
        </SettingsSubDialogContent>
      </SettingsSubDialog>
    </SettingsRow>
  )
}

// --- Two Factor ---

function TwoFactorRow() {
  const session = authClient.useSession()
  const isTwoFactorEnabled = session.data?.user?.twoFactorEnabled ?? false

  const [isDisabling, setIsDisabling] = useState(false)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [error, setError] = useState('')

  const handleDisable = async () => {
    setError('')
    setIsDisabling(true)

    // @ts-expect-error -- plugin types not inferred through Convex adapter
    const { error: err } = await authClient.twoFactor.disable({
      password: disablePassword,
    })

    if (err) {
      setError(err.message || 'Failed to disable 2FA')
      setIsDisabling(false)
      return
    }

    toast.success('Two-factor authentication disabled')
    setShowDisableDialog(false)
    setDisablePassword('')
    setIsDisabling(false)
    session.refetch()
  }

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
          setDisablePassword('')
          setError('')
          setShowDisableDialog(true)
        } else {
          // TODO: implement enable 2FA flow in dialog
          toast.info('2FA setup coming soon')
        }
      }}
    >
      <SettingsSubDialog
        open={showDisableDialog}
        onOpenChange={setShowDisableDialog}
      >
        <SettingsSubDialogContent>
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
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
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
        </SettingsSubDialogContent>
      </SettingsSubDialog>
    </SettingsRow>
  )
}

// --- Delete Account ---

function DeleteAccountRow() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setIsDeleting(true)
    setError('')
    await authClient.deleteUser({
      fetchOptions: {
        onSuccess: () => {
          setIsDeleting(false)
          setEmailSent(true)
        },
        onError: (ctx) => {
          setIsDeleting(false)
          setError(ctx.error?.message || 'Failed to delete account')
        },
      },
    })
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      setShowConfirm(false)
      setEmailSent(false)
      setError('')
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-destructive">Delete account</p>
        <p className="text-sm text-destructive/70">
          Permanently delete your account and all data
        </p>
      </div>
      {error && <p className="text-sm text-destructive mr-2">{error}</p>}
      <Button
        variant="destructive"
        size="sm"
        className="shrink-0"
        disabled={isDeleting}
        onClick={() => setShowConfirm(true)}
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          'Delete account'
        )}
      </Button>
      <SettingsSubAlertDialog open={showConfirm} onOpenChange={handleClose}>
        <SettingsSubAlertDialogContent>
          {emailSent ? (
            <>
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <Mail className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Check your email</p>
                  <p className="text-sm text-muted-foreground">
                    We sent a verification link to confirm account deletion.
                    Click the link in the email to permanently delete your
                    account.
                  </p>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Done</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and remove all of
                  your data. This action cannot be undone. We'll send a
                  verification email to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Delete account'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </SettingsSubAlertDialogContent>
      </SettingsSubAlertDialog>
    </div>
  )
}

// --- Active Sessions ---

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
} as const

function ActiveSessionsSection() {
  const { sessions, isLoading, revokeSession, revokeOtherSessions } =
    useActiveSessions()
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [isRevokingAll, setIsRevokingAll] = useState(false)

  const handleRevokeSession = async (token: string) => {
    setRevokingId(token)
    try {
      await revokeSession(token)
    } catch {
      toast.error('Failed to revoke session')
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAllOtherSessions = async () => {
    setIsRevokingAll(true)
    try {
      await revokeOtherSessions()
    } catch {
      toast.error('Failed to log out other sessions')
    } finally {
      setIsRevokingAll(false)
    }
  }

  const otherSessionsExist = sessions.some((s) => !s.isCurrent)

  if (isLoading) {
    return (
      <SettingsSection title="Active sessions">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="Active sessions">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 text-xs">Device</TableHead>
            <TableHead className="h-8 text-xs">Last active</TableHead>
            <TableHead className="h-8 text-xs">IP address</TableHead>
            <TableHead className="h-8 text-xs text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => {
            const DeviceIcon = deviceIcons[session.type]
            return (
              <TableRow key={session.id} className="hover:bg-transparent">
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-2.5">
                    <DeviceIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{session.device}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.browser}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2.5">
                  <p className="text-sm text-muted-foreground">
                    {session.lastActive}
                  </p>
                </TableCell>
                <TableCell className="py-2.5">
                  <p className="text-sm text-muted-foreground">
                    {session.ipAddress ?? 'Unknown'}
                  </p>
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  {session.isCurrent ? (
                    <Button variant="outline" size="sm" disabled>
                      Current
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(session.token)}
                      disabled={revokingId === session.token || isRevokingAll}
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <span
                          className={cn(
                            revokingId === session.token && 'invisible',
                          )}
                        >
                          Log out
                        </span>
                        {revokingId === session.token && (
                          <Loader2 className="size-3.5 animate-spin absolute" />
                        )}
                      </span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {otherSessionsExist && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Log out other sessions</p>
              <p className="text-xs text-muted-foreground">
                This will sign you out of all other devices
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={handleRevokeAllOtherSessions}
              disabled={isRevokingAll}
            >
              <span className="relative inline-flex items-center justify-center">
                <span className={cn(isRevokingAll && 'invisible')}>
                  Log out of all devices
                </span>
                {isRevokingAll && (
                  <Loader2 className="size-3.5 animate-spin absolute" />
                )}
              </span>
            </Button>
          </div>
        </>
      )}
    </SettingsSection>
  )
}

// --- User ID ---

function UserIdRow({ userId }: { userId: Id<'userProfiles'> }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">User ID</p>
        <p className="text-sm text-muted-foreground truncate font-mono">
          {userId}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className={cn(
          'shrink-0',
          copied && 'text-green-600 hover:text-green-600',
        )}
      >
        {copied ? (
          <>
            <CheckIcon className="size-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Copy
          </>
        )}
      </Button>
    </div>
  )
}
