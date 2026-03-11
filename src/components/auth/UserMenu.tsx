import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { LogOut, Settings } from '~/lib/icons'
import { authClient } from '~/lib/auth-client'
import { fetchDeviceSessions } from '~/lib/device-sessions'
import { useTransitionOverlay } from '~/lib/transition-overlay'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/components/shadcn/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { buttonVariants } from '~/components/shadcn/ui/button'
import { cn } from '~/lib/shadcn/utils'
import { useAuthQuery } from '~/hooks/useAuthQuery'
import { useSettingsStore } from '~/components/settings/settings-store'
import { AccountSwitcher } from '~/components/auth/AccountSwitcher'
import { getAvatarFallback } from '~/components/auth/avatar-utils'
import { useDeviceSessions } from '~/hooks/useAuthSessions'

const avatarButtonClassName = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  'rounded-full',
)

function AvatarPlaceholder() {
  return (
    <button className={avatarButtonClassName} disabled>
      <Avatar size="sm">
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    </button>
  )
}

export function UserMenu() {
  const [mounted, setMounted] = useState(false)
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const openSettings = useSettingsStore((s) => s.open)
  const queryClient = useQueryClient()
  const deviceSessions = useDeviceSessions()
  const showOverlay = useTransitionOverlay((s) => s.show)

  const handleSwitchAccount = useCallback(
    async (sessionToken: string) => {
      showOverlay('Switching accounts\u2026')
      try {
        // @ts-expect-error -- plugin types not inferred through Convex adapter
        await authClient.multiSession.setActive({ sessionToken })
        window.location.href = '/campaigns'
      } catch (error) {
        console.error('Failed to switch account:', error)
        window.location.reload()
      }
    },
    [showOverlay],
  )

  const handleSignOut = useCallback(async () => {
    showOverlay('Signing out\u2026')
    try {
      const token = deviceSessions.currentToken
      if (token) {
        // @ts-expect-error -- plugin types not inferred through Convex adapter
        await authClient.multiSession.revoke({ sessionToken: token })
      } else {
        await authClient.signOut()
      }
      queryClient.clear()

      const remaining = await fetchDeviceSessions()
      window.location.href =
        remaining.length > 0 ? '/sign-in?view=picker' : '/sign-in'
    } catch (error) {
      console.error('Failed to sign out:', error)
      window.location.reload()
    }
  }, [queryClient, showOverlay, deviceSessions.currentToken])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !profile) {
    return <AvatarPlaceholder />
  }

  const otherAccounts = deviceSessions.allSessions.filter(
    (ds) => profile.email && ds.user.email !== profile.email,
  )

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) deviceSessions.refresh()
      }}
    >
      <DropdownMenuTrigger
        render={
          <button className={avatarButtonClassName}>
            <Avatar size="sm">
              {profile.imageUrl && (
                <AvatarImage src={profile.imageUrl} alt={profile.name ?? ''} />
              )}
              <AvatarFallback>
                {getAvatarFallback(profile.name, profile.email)}
              </AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex items-center gap-3">
              <Avatar size="default">
                {profile.imageUrl && (
                  <AvatarImage
                    src={profile.imageUrl}
                    alt={profile.name ?? ''}
                  />
                )}
                <AvatarFallback>
                  {getAvatarFallback(profile.name, profile.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                {profile.name && (
                  <span className="text-sm font-medium">{profile.name}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  @{profile.username}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <AccountSwitcher
          otherAccounts={otherAccounts}
          onAddAccount={() => {
            window.location.href = '/sign-in?view=form'
          }}
          onSwitch={handleSwitchAccount}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openSettings()}>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
