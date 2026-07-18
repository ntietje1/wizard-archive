import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from '@blocknote/react'
import { CircleAlert, Share2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import type { NoteBlockId } from '../../resources/domain-id'
import {
  NOTE_BLOCK_VISIBILITY,
  projectNoteBlockSelectionAccess,
} from '../../resources/note-block-access-policy'
import type { NoteBlockNoteEditor } from '../note-editor-schema'
import { getBlockShareTargetIds, getBlockShareTitle } from '../sharing/block-share-targets'
import {
  useNoteBlockAccessKnowledge,
  useNoteBlockAccessMenu,
} from '../sharing/note-block-access-menu-context'

export function ShareSideMenuButton({ tooltipDisabled }: { tooltipDisabled: boolean }) {
  const runtime = useNoteBlockAccessMenu()
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor() as NoteBlockNoteEditor
  const sideMenu = useExtension(SideMenuExtension)
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  })
  const blockIds = block ? getBlockShareTargetIds(editor, block.id as NoteBlockId) : []
  const knowledge = useNoteBlockAccessKnowledge(
    runtime?.gateway ?? null,
    runtime?.noteId ?? null,
    blockIds,
  )
  if (!runtime || !block) return null
  const selection =
    knowledge.state === 'known' ? projectNoteBlockSelectionAccess(knowledge.value, blockIds) : null
  const shared =
    selection?.audienceVisibility === NOTE_BLOCK_VISIBILITY.visible ||
    selection?.participants.some(
      (participant) =>
        participant.kind === 'controllable' &&
        participant.hasExplicitAccess &&
        participant.visibility === NOTE_BLOCK_VISIBILITY.visible,
    )
  const inaccessibleShare = selection?.participants.some(
    (participant) =>
      participant.kind === 'controllable' &&
      participant.participant.notePermission === 'none' &&
      (participant.visibility === NOTE_BLOCK_VISIBILITY.visible ||
        (!participant.hasExplicitAccess &&
          selection.audienceVisibility === NOTE_BLOCK_VISIBILITY.visible)),
  )

  const open = (event: React.MouseEvent | React.KeyboardEvent, kind: 'context' | 'sharing') => {
    if (runtime.pending || knowledge.state !== 'known') return
    const rect = event.currentTarget.getBoundingClientRect()
    runtime.open({
      blockIds,
      kind,
      title: getBlockShareTitle(blockIds.length),
      sideMenu,
      position:
        'clientX' in event && event.detail > 0
          ? { x: event.clientX, y: event.clientY }
          : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    })
  }
  const click = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (runtime.pending || knowledge.state !== 'known' || event.ctrlKey || event.metaKey) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (event.shiftKey) {
      void runtime.execute({
        type: 'setNoteBlockAudienceAccess',
        noteId: runtime.noteId,
        blockIds,
        shared: selection?.audienceVisibility !== NOTE_BLOCK_VISIBILITY.visible,
      })
      return
    }
    open(event, 'sharing')
  }

  return (
    <Tooltip disabled={tooltipDisabled}>
      <TooltipTrigger
        render={
          <span
            className="inline-flex"
            onContextMenu={(event: React.MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              open(event, 'context')
            }}
          >
            <Components.SideMenu.Button
              label={blockIds.length > 1 ? `Share ${blockIds.length} blocks` : 'Share'}
              className={`${shared ? '!text-primary' : '!text-muted-foreground'} ${
                runtime.pending || knowledge.state !== 'known'
                  ? 'pointer-events-none opacity-50'
                  : ''
              }`}
              aria-disabled={runtime.pending || knowledge.state !== 'known'}
              icon={
                <span className="relative">
                  <Share2 size={18} />
                  {inaccessibleShare && (
                    <CircleAlert className="absolute -right-1.5 -top-1.5 size-3 fill-background text-warning" />
                  )}
                </span>
              }
              onClick={click}
              data-testid="block-share-button"
            />
          </span>
        }
      />
      <TooltipContent side="bottom" className="whitespace-pre-line">
        <span className="block">
          <em>Click</em> to open visibility
        </span>
        <span className="block">
          <em>Shift click</em> to toggle all players
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
