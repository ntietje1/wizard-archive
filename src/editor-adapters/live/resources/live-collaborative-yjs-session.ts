import type { CollaborationUser } from '@wizard-archive/editor/resources/content-session-contract'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { createLiveResourceAwareness } from './live-resource-awareness'
import type { LiveResourceAwarenessBackend } from './live-resource-awareness'
import { createLiveYjsDocumentSession } from './live-yjs-document-session'
import type { LiveYjsDocumentSessionOptions } from './live-yjs-document-session'

type LiveCollaborativeYjsSessionOptions = Omit<
  LiveYjsDocumentSessionOptions,
  'disposeCompanion' | 'flushCompanion'
> &
  Readonly<{
    awarenessBackend: LiveResourceAwarenessBackend
    memberId: CampaignMemberId
    resourceId: ResourceId
    user: CollaborationUser
  }>

export function createLiveCollaborativeYjsSession(options: LiveCollaborativeYjsSessionOptions) {
  const { awarenessBackend, memberId, resourceId, user, ...sessionOptions } = options
  const awareness = createLiveResourceAwareness(
    sessionOptions.document,
    resourceId,
    memberId,
    user,
    awarenessBackend,
    sessionOptions.changed,
  )
  try {
    const session = createLiveYjsDocumentSession({
      ...sessionOptions,
      flushCompanion: () => awareness.flush(),
      disposeCompanion: () => awareness.dispose(),
    })
    return { awareness, session }
  } catch (error) {
    void awareness.dispose()
    throw error
  }
}
