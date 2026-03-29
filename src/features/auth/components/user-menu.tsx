import { useState, useSyncExternalStore } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/features/shadcn/components/popover'
import { buttonVariants } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getInitials } from '~/shared/utils/get-initials'
import { useDeviceSessions } from '~/features/auth/hooks/useAuthSessions'
import { UserMenuContent } from '~/features/auth/components/user-menu-content'

const avatarButtonClassName = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  'rounded-full',
)

function AvatarPlaceholder() {
  return (
    <button
      className={avatarButtonClassName}
      disabled
      aria-label="User menu loading"
    >
      <Avatar size="sm">
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    </button>
  )
}

function UserMenuBase() {
  const [open, setOpen] = useState(false)
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const deviceSessions = useDeviceSessions()

  if (!profile) {
    return <AvatarPlaceholder />
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) deviceSessions.refresh()
      }}
    >
      <PopoverTrigger
        nativeButton
        render={
          <button className={avatarButtonClassName} aria-label="User menu">
            <Avatar size="sm">
              {profile.imageUrl && (
                <AvatarImage src={profile.imageUrl} alt={profile.name ?? ''} />
              )}
              <AvatarFallback>
                {getInitials(profile.name, profile.email)}
              </AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="p-0 min-w-56"
      >
        <UserMenuContent onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

export function UserMenu() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  if (!mounted) {
    return <AvatarPlaceholder />
  }
  return (
    <ClientOnly>
      <UserMenuBase />
    </ClientOnly>
  )
}
