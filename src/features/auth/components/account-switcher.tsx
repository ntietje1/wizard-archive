import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import type { DeviceSession } from '~/features/auth/utils/device-sessions'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'
import { getInitials } from '~/shared/utils/get-initials'

type AccountSwitcherProps = {
  otherAccounts: Array<DeviceSession>
  onAddAccount: () => void
  onSwitch: (sessionToken: string) => Promise<void>
}

const menuItemClass =
  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left cursor-pointer hover:bg-muted/70'

export function AccountRow({
  name,
  subtitle,
  imageUrl,
  fallback,
  rightSlot,
}: {
  name?: string | null
  subtitle: string
  imageUrl?: string | null
  fallback: string
  rightSlot?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 w-full">
      <Avatar size="default">
        {imageUrl && <AvatarImage src={imageUrl} alt={name ?? ''} />}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0 flex-1">
        {name && <span className="text-sm font-medium truncate">{name}</span>}
        <span className="text-xs text-muted-foreground truncate">
          {subtitle}
        </span>
      </div>
      {rightSlot}
    </div>
  )
}

export function AccountSwitcher({
  otherAccounts,
  onAddAccount,
  onSwitch,
}: AccountSwitcherProps) {
  const [switching, setSwitching] = useState<string | null>(null)

  const handleSwitch = async (sessionToken: string) => {
    setSwitching(sessionToken)
    try {
      await onSwitch(sessionToken)
      setSwitching(null)
    } catch (error) {
      setSwitching(null)
      console.error(error)
      throw error
    }
  }

  if (otherAccounts.length === 0) {
    return (
      <>
        <div className="border-t my-1" />
        <button type="button" className={menuItemClass} onClick={onAddAccount}>
          <Plus className="size-4" />
          Add another account
        </button>
      </>
    )
  }

  return (
    <>
      <div className="border-t my-1" />
      {otherAccounts.map((ds) => {
        const isSwitching = switching === ds.session.token
        return (
          <button
            key={ds.session.token}
            type="button"
            className={menuItemClass}
            onClick={() => handleSwitch(ds.session.token)}
            disabled={switching !== null}
          >
            <AccountRow
              name={ds.user.name}
              subtitle={ds.user.email}
              imageUrl={ds.user.image}
              fallback={getInitials(ds.user.name, ds.user.email)}
              rightSlot={
                isSwitching ? (
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                ) : undefined
              }
            />
          </button>
        )
      })}
      <button type="button" className={menuItemClass} onClick={onAddAccount}>
        <Plus className="size-4" />
        Add another account
      </button>
    </>
  )
}
