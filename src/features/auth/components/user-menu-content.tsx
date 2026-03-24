import { LogOut, Settings } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { authClient } from '~/features/auth/utils/auth-client'
import { fetchDeviceSessions } from '~/features/auth/utils/device-sessions'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getInitials } from '~/shared/utils/get-initials'
import { useSettingsStore } from '~/features/settings/hooks/settings-store'
import {
  AccountRow,
  AccountSwitcher,
} from '~/features/auth/components/account-switcher'
import { useDeviceSessions } from '~/features/auth/hooks/useAuthSessions'

const menuItemClass =
  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/70'

export function UserMenuContent({ onClose }: { onClose: () => void }) {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const openSettings = useSettingsStore((s) => s.open)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const deviceSessions = useDeviceSessions()

  const handleSwitchAccount = async (sessionToken: string) => {
    try {
      await authClient.multiSession.setActive({ sessionToken })
      navigate({ to: '/campaigns', reloadDocument: true })
    } catch (error) {
      console.error('Failed to switch account:', error)
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

      const remaining = await fetchDeviceSessions()
      navigate({
        to: '/sign-in',
        search: remaining.length > 0 ? { view: 'picker' } : {},
      })
    } catch (error) {
      console.error('Failed to sign out:', error)
      window.location.reload()
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
          fallback={getInitials(profile.name, profile.email)}
        />
      </div>

      <div className="p-1">
        <AccountSwitcher
          otherAccounts={otherAccounts}
          onAddAccount={() => {
            navigate({
              to: '/sign-in',
              search: { view: 'form' },
            })
          }}
          onSwitch={handleSwitchAccount}
        />

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
