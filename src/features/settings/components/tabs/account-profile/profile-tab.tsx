import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { SettingsSection } from '~/features/settings/components/settings-section'
import { AccountRow } from './components/account-row'
import { UsernameRow } from './components/username-row'
import { EmailRow } from './components/email-row'
import { PasswordRow } from './components/password-row'
import { TwoFactorRow } from './components/two-factor-row'
import { DeleteAccountRow } from './components/delete-account-row'
import { ActiveSessionsSection } from './components/active-sessions-section'
import { UserIdRow } from './components/user-id-row'
import { Separator } from '@wizard-archive/ui/shadcn/components/separator'
import { useUserProfileQuery } from '~/shared/hooks/use-user-profile-operations'

export function ProfileTab() {
  const navigate = useNavigate()
  const profileQuery = useUserProfileQuery()
  const profile = profileQuery.data
  const deletionPendingRef = useRef(false)

  useEffect(() => {
    if (deletionPendingRef.current && !profileQuery.isLoading && !profile) {
      deletionPendingRef.current = false
      void navigate({ to: '/sign-in', replace: true })
    }
  }, [profileQuery.isLoading, profile, navigate])

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

      {profileQuery.isError && <p className="text-sm text-destructive">Failed to load profile</p>}

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
              onDeletionEmailSent={() => {
                deletionPendingRef.current = true
              }}
            />
          </SettingsSection>

          <ActiveSessionsSection />

          <SettingsSection title="User ID">
            <UserIdRow userId={profile.id} />
          </SettingsSection>
        </>
      )}
    </div>
  )
}
