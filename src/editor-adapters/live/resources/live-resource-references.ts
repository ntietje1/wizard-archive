import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { parseAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import type { ReferenceGraphEdge } from '@wizard-archive/editor/resources/authored-destination'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceReferenceSource,
  ResourceReferenceState,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceLoadResult } from '@wizard-archive/editor/resources/index-contract'
import { createLivePresentationSubscriptions } from './live-presentation-subscriptions'

type StoredReferenceSnapshot = FunctionReturnType<
  typeof api.resources.queries.loadResourceReferences
>
type StoredAuthorizedProjection = Extract<StoredReferenceSnapshot, { status: 'ready' }>['snapshot']

const LOADING: ResourceReferenceState = { status: 'loading' }

export function createLiveResourceReferenceSource(
  applyProjection: (snapshot: StoredAuthorizedProjection) => ResourceLoadResult,
  watch: (resourceId: ResourceId, apply: (snapshot: StoredReferenceSnapshot) => void) => () => void,
): Readonly<{ source: ResourceReferenceSource; dispose(): void }> {
  const states = new Map<ResourceId, ResourceReferenceState>()
  const watches = new Map<ResourceId, () => void>()
  const subscriptions = createLivePresentationSubscriptions<ResourceId>(
    (resourceId) => {
      watches.set(
        resourceId,
        watch(resourceId, (snapshot) => {
          states.set(resourceId, readSnapshot(snapshot, applyProjection))
          subscriptions.publish(resourceId)
        }),
      )
    },
    (resourceId) => {
      watches.get(resourceId)?.()
      watches.delete(resourceId)
      states.delete(resourceId)
    },
  )
  return {
    source: {
      get: (resourceId) => states.get(resourceId) ?? LOADING,
      subscribe: subscriptions.subscribe,
    },
    dispose: () => {
      for (const dispose of watches.values()) dispose()
      watches.clear()
      states.clear()
      subscriptions.clear()
    },
  }
}

function readSnapshot(
  snapshot: StoredReferenceSnapshot,
  applyProjection: (snapshot: StoredAuthorizedProjection) => ResourceLoadResult,
): ResourceReferenceState {
  if (snapshot.status === 'unavailable') return { status: 'unavailable' }
  if (snapshot.status === 'integrity_error') return { status: 'error' }
  try {
    if (applyProjection(snapshot.snapshot).status !== 'completed') {
      return { status: 'error' }
    }
    return {
      status: 'ready',
      outgoing: snapshot.outgoing.map(readEdge),
      backlinks: snapshot.backlinks.map(readEdge),
    }
  } catch {
    return { status: 'error' }
  }
}

function readEdge(value: {
  sourceResourceId: string
  sourceVersion: unknown
  target: unknown
}): ReferenceGraphEdge {
  const destination = parseAuthoredDestination({ kind: 'internal', target: value.target })
  if (destination?.kind !== 'internal') throw new TypeError('Invalid resource reference target')
  return {
    sourceResourceId: assertDomainId(DOMAIN_ID_KIND.resource, value.sourceResourceId),
    sourceVersion: assertVersionStamp(value.sourceVersion),
    target: destination.target,
  }
}
