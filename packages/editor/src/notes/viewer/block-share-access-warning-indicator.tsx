import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { BlockShareAccessWarning } from '../../notes/item-contract'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { getClientErrorMessage } from '../../../../../shared/errors/client'
import { ConfirmationDialog } from '@wizard-archive/ui/components/confirmation-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import type { NoteEditorSetParticipantPermission } from './note-editor-source'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { EditorShareParticipant } from '../../sharing/contracts'

const EMPTY_WARNINGS: Array<BlockShareAccessWarning> = []

export function BlockShareAccessWarningIndicator({
  noteId,
  participants,
  setParticipantPermission,
  warnings = EMPTY_WARNINGS,
}: {
  noteId: SidebarItemId
  participants: Array<EditorShareParticipant>
  setParticipantPermission: NoteEditorSetParticipantPermission
  warnings?: Array<BlockShareAccessWarning>
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  if (warnings.length === 0) return null

  const participantsById = new Map(participants.map((participant) => [participant.id, participant]))
  const warningMembers = warnings.map((warning) => {
    const participant = participantsById.get(warning.campaignMemberId)
    return {
      ...warning,
      name: participant ? participant.displayName : 'this player',
    }
  })
  const warningMessage = getWarningMessage(warningMembers)
  const confirmationMessage =
    warnings.length === 1
      ? 'Share this note with this player?'
      : 'Share this note with these players?'

  const handleConfirm = async () => {
    setIsSharing(true)
    try {
      const results = await Promise.allSettled(
        warnings.map(async (warning) => {
          await setParticipantPermission({
            itemIds: [noteId],
            participantId: warning.campaignMemberId,
            permissionLevel: PERMISSION_LEVEL.VIEW,
          })
        }),
      )
      const rejected = results.filter((result) => result.status === 'rejected')
      if (rejected.length > 0) {
        const message = getShareFailureMessage(rejected.map((result) => result.reason))
        toast.error(message)
        console.error(rejected.map((result) => result.reason))
        return
      }
      setIsConfirmOpen(false)
    } finally {
      setIsSharing(false)
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
              disabled={isSharing}
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
        isLoading={isSharing}
      />
    </div>
  )
}

function getShareFailureMessage(reasons: ReadonlyArray<unknown>): string {
  const messages = reasons
    .map((reason) => getClientErrorMessage(reason))
    .filter((message): message is string => !!message)
  if (messages.length === 0) return 'Failed to share note'
  return [...new Set(messages)].join('\n')
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
