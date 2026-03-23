import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { DeviceSession } from '~/features/auth/utils/device-sessions'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'
import { ChevronRight, Loader2 } from '~/features/shared/utils/icons'
import { getInitials } from '~/features/shared/utils/get-initials'

type AccountPickerProps = {
  sessions: Array<DeviceSession>
  redirectTo: string
  onUseOtherAccount: () => void
}

export function AccountPicker({
  sessions,
  redirectTo,
  onUseOtherAccount,
}: AccountPickerProps) {
  const navigate = useNavigate()
  const [switchingToken, setSwitchingToken] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleSwitch = async (session: DeviceSession) => {
    setError('')
    setSwitchingToken(session.session.token)
    try {
      await authClient.multiSession.setActive({
        sessionToken: session.session.token,
      })
      navigate({ to: redirectTo, reloadDocument: true })
    } catch (err) {
      console.error('Failed to switch account:', err)
      setError('Failed to switch account. Please try signing in again.')
      setSwitchingToken(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Choose an account</h1>
        <p className="text-sm text-muted-foreground text-balance">
          to continue to {"The Wizard's Archive"}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {sessions.map((ds) => {
          const isSwitching = switchingToken === ds.session.token
          return (
            <Button
              key={ds.session.token}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-3 px-3 py-2.5"
              onClick={() => handleSwitch(ds)}
              disabled={!!switchingToken}
            >
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
              {isSwitching ? (
                <Loader2 className="size-4 animate-spin shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </Button>
          )
        })}
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onUseOtherAccount}
      >
        Sign in with a different account
      </Button>
    </div>
  )
}
