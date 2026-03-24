import { Crown, Ellipsis, Trash2 } from 'lucide-react'
import { SettingsSection } from '../../account-profile/components/settings-section'
import { MemberRow } from './member-row'
import type { CampaignMember } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { Badge } from '~/features/shadcn/components/badge'
import { Button } from '~/features/shadcn/components/button'
import { Separator } from '~/features/shadcn/components/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/features/shadcn/components/dropdown-menu'

export function MembersSection({
  dmMember,
  acceptedPlayers,
  isDm,
  onRemovePlayer,
}: {
  dmMember: CampaignMember | undefined
  acceptedPlayers: Array<CampaignMember>
  isDm: boolean
  onRemovePlayer: (memberId: Id<'campaignMembers'>) => void
}) {
  return (
    <SettingsSection title="Members">
      {dmMember && (
        <>
          <MemberRow
            member={dmMember}
            badge={
              <Badge className="gap-1 border-transparent bg-primary/10 text-primary text-xs">
                <Crown className="size-3" />
                DM
              </Badge>
            }
          />
          {acceptedPlayers.length > 0 && <Separator />}
        </>
      )}
      {acceptedPlayers.length === 0 && !dmMember ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          No members yet
        </p>
      ) : (
        acceptedPlayers.map((player, index) => (
          <div key={player._id}>
            {index > 0 && <Separator />}
            <MemberRow
              member={player}
              actions={
                isDm && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 size-8 text-muted-foreground"
                        >
                          <Ellipsis className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onRemovePlayer(player._id)}
                      >
                        <Trash2 />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              }
            />
          </div>
        ))
      )}
    </SettingsSection>
  )
}
