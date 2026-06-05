import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { api } from 'convex/_generated/api'
import type { BlockShareAccessWarning } from 'shared/notes/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { handleError } from '~/shared/utils/logger'
import { getUserDisplayName } from '~/shared/utils/user-display-name'

const EMPTY_WARNINGS: Array<BlockShareAccessWarning> = []

export function BlockShareAccessWarningIndicator({
  noteId,
  warnings = EMPTY_WARNINGS,
}: {
  noteId: Id<'sidebarItems'>
  warnings?: Array<BlockShareAccessWarning>
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const campaignMembersQuery = useCampaignMembers()
  const grantNoteAccess = useCampaignMutation(
    api.sidebarShares.mutations.setSidebarItemsMemberPermission,
  )
  if (warnings.length === 0) return null

  const membersById = new Map(campaignMembersQuery.data?.map((member) => [member._id, member]))
  const warningMembers = warnings.map((warning) => {
    const member = membersById.get(warning.campaignMemberId)
    return {
      ...warning,
      name: member ? getUserDisplayName(member.userProfile) : 'this player',
    }
  })
  const warningMessage = getWarningMessage(warningMembers)
  const confirmationMessage =
    warnings.length === 1
      ? 'Share this note with this player?'
      : 'Share this note with these players?'

  const handleConfirm = async () => {
    try {
      await Promise.all(
        warnings.map((warning) =>
          grantNoteAccess.mutateAsync({
            sidebarItemIds: [noteId],
            campaignMemberId: warning.campaignMemberId,
            permissionLevel: PERMISSION_LEVEL.VIEW,
          }),
        ),
      )
      setIsConfirmOpen(false)
    } catch (error) {
      handleError(error, 'Failed to share note')
    }
  }

  return (
    <div className="absolute top-12 left-2 z-20" data-testid="block-share-access-warning-container">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md bg-transparent p-0 text-destructive outline-none hover:text-destructive/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
              aria-label={warningMessage}
              data-testid="block-share-access-warning"
              disabled={grantNoteAccess.isPending}
              onClick={() => setIsConfirmOpen(true)}
            >
              <CircleAlert className="size-4" />
            </button>
          }
        />
        <TooltipContent side="right" align="start" className="max-w-80">
          {warningMessage}
        </TooltipContent>
      </Tooltip>
      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => void handleConfirm()}
        title="Share note?"
        description={
          <span>
            {warningMessage}
            <br />
            {confirmationMessage}
          </span>
        }
        confirmLabel="Share note"
        confirmVariant="default"
        isLoading={grantNoteAccess.isPending}
      />
    </div>
  )
}

function getWarningMessage(warnings: Array<BlockShareAccessWarning & { name: string }>): string {
  if (warnings.length === 1) {
    const [warning] = warnings
    const verb = warning.blockCount === 1 ? 'is' : 'are'
    const blockText = warning.blockCount === 1 ? 'block' : 'blocks'
    return `There ${verb} ${warning.blockCount} ${blockText} explicitly shared with ${warning.name}, but this note isn't shared with them.`
  }

  return `There are blocks that are shared with ${formatNames(warnings.map((warning) => warning.name))}.`
}

function formatNames(names: Array<string>): string {
  if (names.length <= 1) return names[0] ?? 'this player'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}
