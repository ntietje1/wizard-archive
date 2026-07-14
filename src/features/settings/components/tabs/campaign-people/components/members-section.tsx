import { useState } from 'react'
import { Crown, Ellipsis, Trash2 } from 'lucide-react'
import { SettingsSection } from '~/features/settings/components/settings-section'
import { MemberRow } from './member-row'
import { RemovePlayerDialog } from './remove-player-dialog'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { Badge } from '@wizard-archive/ui/shadcn/components/badge'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Separator } from '@wizard-archive/ui/shadcn/components/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'

export function MembersSection({
  dmMember,
  acceptedPlayers,
  isDm,
  campaignId,
}: {
  dmMember: CampaignMemberSummary | undefined
  acceptedPlayers: Array<CampaignMemberSummary>
  isDm: boolean
  campaignId: CampaignId
}) {
  const [deletingMemberId, setDeletingMemberId] = useState<CampaignMemberId | null>(null)

  const deletingPlayer = acceptedPlayers.find((p) => p.id === deletingMemberId)

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
        <p className="text-sm text-muted-foreground text-center py-2">No members yet</p>
      ) : (
        acceptedPlayers.map((player, index) => (
          <div key={player.id}>
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
                        onClick={() => setDeletingMemberId(player.id)}
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

      <RemovePlayerDialog
        player={deletingPlayer}
        campaignId={campaignId}
        isOpen={!!deletingPlayer}
        onClose={() => setDeletingMemberId(null)}
      />
    </SettingsSection>
  )
}
