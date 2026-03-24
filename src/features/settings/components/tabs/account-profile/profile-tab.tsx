import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { Loader2 } from 'lucide-react'
import { SettingsSection } from './components/settings-section'
import { AccountRow } from './components/account-row'
import { UsernameRow } from './components/username-row'
import { EmailRow } from './components/email-row'
import { PasswordRow } from './components/password-row'
import { TwoFactorRow } from './components/two-factor-row'
import { DeleteAccountRow } from './components/delete-account-row'
import { ActiveSessionsSection } from './components/active-sessions-section'
import { UserIdRow } from './components/user-id-row'
import { Separator } from '~/features/shadcn/components/separator'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function ProfileTab() {
  const navigate = useNavigate()
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const [deletionPending, setDeletionPending] = useState(false)

  useEffect(() => {
    if (deletionPending && !profileQuery.isLoading && !profile) {
      navigate({ to: '/sign-in', replace: true })
    }
  }, [deletionPending, profileQuery.isLoading, profile, navigate])

  return (
    <div className="flex flex-col gap-6">
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
          <SettingsSection title="Account">
            <AccountRow profile={profile} />
            <Separator />
            <UsernameRow profile={profile} />
          </SettingsSection>

          <SettingsSection title="Account security">
            <EmailRow profile={profile} />
            <Separator />
            <PasswordRow />
            <Separator />
            <TwoFactorRow profile={profile} />
            <Separator />
            <DeleteAccountRow
              onDeletionEmailSent={() => setDeletionPending(true)}
            />
          </SettingsSection>

          <ActiveSessionsSection />

          <SettingsSection title="User ID">
            <UserIdRow userId={profile._id} />
          </SettingsSection>
        </>
      )}
    </div>
  )
}
