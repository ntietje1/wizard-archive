import { LogOut, Settings } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/features/auth/utils/auth-client'
import { fetchDeviceSessions } from '~/features/auth/utils/device-sessions'
import { handleError } from '~/shared/utils/logger'
import { useUserProfileQuery } from '~/shared/hooks/use-user-profile-operations'
import { useSettingsStore } from '~/features/settings/hooks/settings-store'
import { AccountRow, AccountSwitcher } from '~/features/auth/components/account-switcher'
import { useDeviceSessions } from '~/features/auth/hooks/useAuthSessions'

const menuItemClass =
  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/70'

export function UserMenuContent({ onClose }: { onClose: () => void }) {
  const profileQuery = useUserProfileQuery()
  const profile = profileQuery.data
  const openSettings = useSettingsStore((s) => s.open)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const deviceSessions = useDeviceSessions()

  const handleSwitchAccount = async (sessionToken: string) => {
    try {
      await authClient.multiSession.setActive({ sessionToken })
      void navigate({ to: '/campaigns', reloadDocument: true })
    } catch (error) {
      handleError(error, 'Failed to switch account')
      deviceSessions.refresh()
    }
  }

  const handleSignOut = async () => {
    try {
      const token = deviceSessions.currentToken
      if (token) {
        await authClient.multiSession.revoke({ sessionToken: token })
      } else {
        await authClient.signOut()
      }
      queryClient.clear()
    } catch (error) {
      handleError(error, 'Failed to sign out')
      window.location.reload()
      return
    }

    try {
      const remaining = await fetchDeviceSessions()
      void navigate({
        to: '/sign-in',
        search: remaining.length > 0 ? { view: 'picker' } : {},
      })
    } catch (error) {
      handleError(error, 'Failed to load remaining accounts after sign out')
      void navigate({
        to: '/sign-in',
        search: {},
      })
    }
  }

  if (!profile) return null

  const otherAccounts = deviceSessions.allSessions.filter(
    (ds) => profile.email && ds.user.email !== profile.email,
  )

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2">
        <AccountRow
          name={profile.name}
          subtitle={`@${profile.username}`}
          imageUrl={profile.imageUrl}
          email={profile.email}
        />
      </div>

      <div className="p-1">
        <AccountSwitcher
          otherAccounts={otherAccounts}
          onAddAccount={() => {
            void navigate({
              to: '/sign-in',
              search: { view: 'form' },
            })
          }}
          onSwitch={handleSwitchAccount}
        />
        {deviceSessions.isError && (
          <div className="px-2 py-1.5 text-xs text-destructive">
            <p>Could not load other accounts.</p>
            <button
              type="button"
              className="mt-1 text-primary underline"
              onClick={() => void deviceSessions.retry()}
            >
              Try Again
            </button>
          </div>
        )}

        <div className="border-t my-1" />

        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            openSettings()
            onClose()
          }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
        <button type="button" className={menuItemClass} onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
