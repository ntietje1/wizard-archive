import { useCallback, useState } from 'react'
import type { DeviceSession } from '~/lib/device-sessions'
import { Loader2, Plus } from '~/lib/icons'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/components/shadcn/ui/avatar'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '~/components/shadcn/ui/dropdown-menu'
import { getInitials } from '~/shared/utils/get-initials'

type AccountSwitcherProps = {
  otherAccounts: Array<DeviceSession>
  onAddAccount: () => void
  onSwitch: (sessionToken: string) => Promise<void>
}

export function AccountSwitcher({
  otherAccounts,
  onAddAccount,
  onSwitch,
}: AccountSwitcherProps) {
  const [switching, setSwitching] = useState<string | null>(null)

  const handleSwitch = useCallback(
    async (sessionToken: string) => {
      setSwitching(sessionToken)
      try {
        await onSwitch(sessionToken)
      } catch (error) {
        console.error(error)
        throw error
      } finally {
        setSwitching(null)
      }
    },
    [onSwitch],
  )

  if (otherAccounts.length === 0) {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault()
            onAddAccount()
          }}
        >
          <Plus className="size-4" />
          Add another account
        </DropdownMenuItem>
      </>
    )
  }

  return (
    <>
      <DropdownMenuSeparator />
      {otherAccounts.map((ds) => {
        const isSwitching = switching === ds.session.token
        return (
          <DropdownMenuItem
            key={ds.session.token}
            onClick={() => handleSwitch(ds.session.token)}
            disabled={switching !== null}
          >
            <div className="flex items-center gap-2.5 w-full">
              <Avatar size="sm">
                {ds.user.image && (
                  <AvatarImage src={ds.user.image} alt={ds.user.name} />
                )}
                <AvatarFallback>
                  {getInitials(ds.user.name, ds.user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">
                  {ds.user.name}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {ds.user.email}
                </span>
              </div>
              {isSwitching && (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        )
      })}
      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault()
          onAddAccount()
        }}
      >
        <Plus className="size-4" />
        Add another account
      </DropdownMenuItem>
    </>
  )
}
