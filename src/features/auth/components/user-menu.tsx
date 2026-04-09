import { useState, useSyncExternalStore } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { Avatar, AvatarFallback } from '~/features/shadcn/components/avatar'
import { UserProfileImage } from '~/shared/components/user-profile-image'
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { buttonVariants } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { UserMenuContent } from '~/features/auth/components/user-menu-content'

const avatarButtonClassName = cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'rounded-full')

function AvatarPlaceholder() {
  return (
    <button className={avatarButtonClassName} disabled aria-label="User menu loading">
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

  if (!profile) {
    return <AvatarPlaceholder />
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <button className={avatarButtonClassName} aria-label="User menu">
            <UserProfileImage
              imageUrl={profile.imageUrl}
              name={profile.name}
              email={profile.email}
              size="sm"
            />
          </button>
        }
      />
      <PopoverContent side="right" align="end" sideOffset={8} className="p-0 min-w-56">
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
