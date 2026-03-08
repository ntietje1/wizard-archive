import { api } from 'convex/_generated/api'
import { Link } from '@tanstack/react-router'
import { LogOut, Settings } from '~/lib/icons'
import { authClient } from '~/lib/auth-client'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/components/shadcn/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { buttonVariants } from '~/components/shadcn/ui/button'
import { cn } from '~/lib/shadcn/utils'
import { useAuthQuery } from '~/hooks/useAuthQuery'

function getInitials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return 'U'
}

export function UserMenu() {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/'
        },
      },
    })
  }

  if (!profile) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              'rounded-full',
            )}
          >
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
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            {profile.name && (
              <span className="text-sm font-medium">{profile.name}</span>
            )}
            {profile.email && (
              <span className="text-xs text-muted-foreground">
                {profile.email}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              @{profile.username}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/settings" />}>
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
