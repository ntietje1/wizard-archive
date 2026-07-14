import type { ResourceId } from '../resources/domain-id'
export interface NoteCollaborationPlayback {
  collaborators: ReadonlyArray<{ color: string; name: string }>
  initialTypingStep: number
  intervalMs?: number
  noteId: ResourceId
  typingBlockIndex: number
  typingText: string
}
