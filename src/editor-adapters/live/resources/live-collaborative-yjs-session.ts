import type {
  CollaborationUser,
  ContentCollaboration,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { createLiveResourcePresence } from './live-resource-presence'
import type { LiveResourcePresenceBackend } from './live-resource-presence'
import { createLiveYjsDocumentSession } from './live-yjs-document-session'
import type { LiveYjsDocumentSessionOptions } from './live-yjs-document-session'

type LiveCollaborativeYjsSessionOptions = Omit<
  LiveYjsDocumentSessionOptions,
  'disposeCompanion' | 'flushCompanion'
> &
  Readonly<{
    presenceBackend: LiveResourcePresenceBackend
    memberId: CampaignMemberId
    resourceId: ResourceId
    user: CollaborationUser
    collaboration?: ContentCollaboration
  }>

export function createLiveCollaborativeYjsSession(options: LiveCollaborativeYjsSessionOptions) {
  const { presenceBackend, memberId, resourceId, user, collaboration, ...sessionOptions } = options
  const presence = createLiveResourcePresence(
    sessionOptions.document,
    resourceId,
    memberId,
    user,
    presenceBackend,
    sessionOptions.changed,
    collaboration,
  )
  try {
    const session = createLiveYjsDocumentSession({
      ...sessionOptions,
      flushCompanion: () => presence.flush(),
      disposeCompanion: () => presence.dispose(),
    })
    return { awareness: presence, session }
  } catch (error) {
    void presence.dispose()
    throw error
  }
}
