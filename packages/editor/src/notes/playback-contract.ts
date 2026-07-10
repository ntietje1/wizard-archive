import type { SidebarItemId } from '../../../../shared/common/ids'

export interface NoteCollaborationPlayback {
  collaborators: ReadonlyArray<{ color: string; name: string }>
  initialTypingStep: number
  intervalMs?: number
  noteId: SidebarItemId
  typingBlockIndex: number
  typingText: string
}
