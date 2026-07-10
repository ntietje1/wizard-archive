import type { Awareness } from 'y-protocols/awareness'
import type { Doc } from 'yjs'

export type YjsProviderUser = {
  name: string
  color: string
}

export interface YjsCollaborationProvider {
  awareness: Awareness
  doc: Doc
  destroy: (options?: { discardPendingUpdates?: boolean }) => void
  emit: (name: 'sync', args: [boolean]) => void
  flushPendingUpdates: () => Promise<boolean>
  flushUpdates: () => Promise<void>
  isApplyingRemoteUpdate: () => boolean
  off: (name: 'sync', handler: (synced: boolean) => void) => void
  on: (name: 'sync', handler: (synced: boolean) => void) => void
  updateUser: (user: YjsProviderUser) => void
}

const DEFAULT_CURSOR_COLOR = '#61afef'
const CURSOR_COLORS = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#56b6c2',
  DEFAULT_CURSOR_COLOR,
  '#c678dd',
  '#d19a66',
  '#be5046',
]

export function createYjsProviderUser({
  name,
  userId,
}: {
  name: string | null | undefined
  userId: string | null | undefined
}): YjsProviderUser {
  return {
    name: name?.trim() || 'Anonymous',
    color: userId ? getCursorColor(userId) : DEFAULT_CURSOR_COLOR,
  }
}

function getCursorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}
