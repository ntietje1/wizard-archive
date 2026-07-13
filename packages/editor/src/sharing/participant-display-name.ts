import type { EditorShareParticipant } from './contracts'

export function getParticipantDisplayName(participant: EditorShareParticipant): string {
  return participant.displayName || (participant.username ? `@${participant.username}` : 'Player')
}
