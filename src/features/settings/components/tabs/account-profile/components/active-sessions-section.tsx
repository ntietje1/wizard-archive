import { useState } from 'react'
import { Loader2, Monitor, Smartphone, Tablet } from 'lucide-react'
import { SettingsSection } from './settings-section'
import { useActiveSessions } from '~/features/auth/hooks/useAuthSessions'
import { Button } from '~/features/shadcn/components/button'
import { Separator } from '~/features/shadcn/components/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/features/shadcn/components/table'
import { cn } from '~/features/shadcn/lib/utils'

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
} as const

export function ActiveSessionsSection() {
  const { sessions, isLoading, revokeSession, revokeOtherSessions } =
    useActiveSessions()
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [isRevokingAll, setIsRevokingAll] = useState(false)

  const handleRevokeSession = async (token: string) => {
    setRevokingId(token)
    try {
      await revokeSession(token)
    } catch {
      // Error toast handled by useAuthSessions onError
    }
    setRevokingId(null)
  }

  const handleRevokeAllOtherSessions = async () => {
    setIsRevokingAll(true)
    try {
      await revokeOtherSessions()
    } catch {
      // Error toast handled by useAuthSessions onError
    }
    setIsRevokingAll(false)
  }

  const otherSessionsExist = sessions.some((s) => !s.isCurrent)

  if (isLoading) {
    return (
      <SettingsSection title="Active sessions">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="Active sessions">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 text-xs">Device</TableHead>
            <TableHead className="h-8 text-xs">Last active</TableHead>
            <TableHead className="h-8 text-xs">IP address</TableHead>
            <TableHead className="h-8 text-xs text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => {
            const DeviceIcon = deviceIcons[session.type]
            return (
              <TableRow key={session.id} className="hover:bg-transparent">
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-2.5">
                    <DeviceIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{session.device}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.browser}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2.5">
                  <p className="text-sm text-muted-foreground">
                    {session.lastActive}
                  </p>
                </TableCell>
                <TableCell className="py-2.5">
                  <p className="text-sm text-muted-foreground">
                    {session.ipAddress ?? 'Unknown'}
                  </p>
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  {session.isCurrent ? (
                    <Button variant="outline" size="sm" disabled>
                      Current
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(session.token)}
                      disabled={revokingId === session.token || isRevokingAll}
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <span
                          className={cn(
                            revokingId === session.token && 'invisible',
                          )}
                        >
                          Log out
                        </span>
                        {revokingId === session.token && (
                          <Loader2 className="size-3.5 animate-spin absolute" />
                        )}
                      </span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {otherSessionsExist && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Log out other sessions</p>
              <p className="text-xs text-muted-foreground">
                This will sign you out of all other devices
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={handleRevokeAllOtherSessions}
              disabled={isRevokingAll}
            >
              <span className="relative inline-flex items-center justify-center">
                <span className={cn(isRevokingAll && 'invisible')}>
                  Log out of all devices
                </span>
                {isRevokingAll && (
                  <Loader2 className="size-3.5 animate-spin absolute" />
                )}
              </span>
            </Button>
          </div>
        </>
      )}
    </SettingsSection>
  )
}
