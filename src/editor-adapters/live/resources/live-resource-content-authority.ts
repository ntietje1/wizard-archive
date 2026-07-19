import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type {
  ContentCollaboration,
  ContentSessionSaveResult,
  SessionAwareness,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type * as Y from 'yjs'

export interface LiveResourceContentAuthority {
  canEdit(resourceId: ResourceId): boolean
  subscribe(listener: () => void): () => void
}

type AuthorityBoundYjsSession = Readonly<{
  document: Y.Doc
  version: VersionStamp
  detach(): YjsSessionSurface
  dispose(): void
}>

export type YjsSessionSurface = Readonly<{
  collaboration: ContentCollaboration
  document: Y.Doc
  release?(): void
}>

export type YjsSessionAuthorityTransition = Readonly<{
  editable: boolean
  version: VersionStamp
}> &
  YjsSessionSurface

export interface YjsSessionAuthorityBinding {
  reconcile(resourceId: ResourceId): void
  dispose(): void
}

export function createLiveAuthorityBoundYjsSession(
  liveAwareness: Readonly<{
    readonly awareness: SessionAwareness
    readonly collaboration: ContentCollaboration
    detachCollaboration(): ContentCollaboration
  }>,
  session: Readonly<{
    readonly document: Y.Doc
    readonly version: VersionStamp
    apply(update: ArrayBuffer, version: VersionStamp): YjsVersionDecision
    replace(
      generation: ContentGeneration,
      version: VersionStamp,
      replaceDocument: (origin: unknown) => void,
    ): YjsVersionDecision
    detachDocument(): Y.Doc
    dispose(): void
    flush(): Promise<ContentSessionSaveResult>
    retain(): () => void
  }>,
) {
  return {
    get document() {
      return session.document
    },
    get version() {
      return session.version
    },
    get awareness() {
      return liveAwareness.awareness
    },
    get collaboration() {
      return liveAwareness.collaboration
    },
    apply: (update: ArrayBuffer, version: VersionStamp) => session.apply(update, version),
    replace: (
      generation: ContentGeneration,
      version: VersionStamp,
      replaceDocument: (origin: unknown) => void,
    ) => session.replace(generation, version, replaceDocument),
    flush: () => session.flush(),
    retain: () => session.retain(),
    dispose: () => session.dispose(),
    detach: (): YjsSessionSurface => {
      const collaboration = liveAwareness.detachCollaboration()
      return { collaboration, document: session.detachDocument() }
    },
  }
}

type YjsVersionDecision = 'applied' | 'conflict' | 'duplicate' | 'stale'

export function createYjsSessionAuthorityBinding<TSession extends AuthorityBoundYjsSession>(
  authority: LiveResourceContentAuthority,
  sessions: Map<ResourceId, TSession>,
  isReadonly: (session: TSession) => boolean,
  apply: (resourceId: ResourceId, transition: YjsSessionAuthorityTransition) => void,
): YjsSessionAuthorityBinding {
  const reconcile = (resourceId: ResourceId) => {
    const session = sessions.get(resourceId)
    if (!session) return
    const editable = authority.canEdit(resourceId)
    if (editable !== isReadonly(session)) return
    const version = session.version
    const surface = session.detach()
    sessions.delete(resourceId)
    apply(resourceId, { ...surface, editable, version })
  }
  const unsubscribe = authority.subscribe(() => {
    for (const resourceId of sessions.keys()) reconcile(resourceId)
  })
  return { reconcile, dispose: unsubscribe }
}
