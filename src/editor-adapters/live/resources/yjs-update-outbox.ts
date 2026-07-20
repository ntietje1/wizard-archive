import * as Y from 'yjs'
import type {
  CampaignId,
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import { assertContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import { CANVAS_WORKLOAD_LIMITS } from '@wizard-archive/editor/canvas/workload'
import { noteYjsEncodedBytesWithinLimit } from '@wizard-archive/editor/notes/document-yjs'

type YjsUpdateOutboxUnavailable = Readonly<{ status: 'unavailable' }>
type YjsUpdateOutboxReadResult =
  | Readonly<{
      status: 'available'
      entry:
        | Readonly<{
            generation: ContentGeneration
            state: 'pending'
            update: Uint8Array
          }>
        | Readonly<{
            generation: ContentGeneration
            operationId: OperationId
            state: 'recovery'
            update: Uint8Array
          }>
        | null
    }>
  | YjsUpdateOutboxUnavailable
type YjsUpdateOutboxWriteResult =
  | Readonly<{ status: 'accepted' }>
  | Readonly<{ status: 'generation_conflict' }>
  | YjsUpdateOutboxUnavailable
type YjsUpdateOutboxStorageResult = Readonly<{ status: 'accepted' }> | YjsUpdateOutboxUnavailable

export type YjsUpdateOutbox = Readonly<{
  clear(): YjsUpdateOutboxStorageResult
  load(): YjsUpdateOutboxReadResult
  merge(generation: ContentGeneration, update: Uint8Array): YjsUpdateOutboxWriteResult
  preserve(
    generation: ContentGeneration,
    operationId: OperationId,
    update: Uint8Array,
  ): YjsUpdateOutboxWriteResult
  replace(generation: ContentGeneration, update: Uint8Array): YjsUpdateOutboxWriteResult
}>

type YjsUpdateOutboxStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export function createYjsUpdateOutbox(
  kind: 'canvas' | 'note',
  campaignId: CampaignId,
  resourceId: ResourceId,
  memberId: CampaignMemberId,
  storage: YjsUpdateOutboxStorage | null = browserSessionStorage(),
): YjsUpdateOutbox {
  const key = `wizard-archive:${kind}-update-outbox:v4:${memberId}:${campaignId}:${resourceId}`
  const load = (): YjsUpdateOutboxReadResult => {
    if (!storage) return { status: 'unavailable' }
    try {
      const encoded = storage.getItem(key)
      if (encoded === null) return { status: 'available', entry: null }
      const firstSeparator = encoded.indexOf(':')
      const secondSeparator = encoded.indexOf(':', firstSeparator + 1)
      if (firstSeparator < 1 || secondSeparator < 1) return { status: 'unavailable' }
      const state = encoded.slice(0, firstSeparator)
      if (state !== 'pending' && state !== 'recovery') return { status: 'unavailable' }
      const generation = assertContentGeneration(
        Number(encoded.slice(firstSeparator + 1, secondSeparator)),
      )
      if (state === 'pending') {
        const update = decodeBase64(encoded.slice(secondSeparator + 1))
        return updateWithinLimit(kind, update)
          ? { status: 'available', entry: { generation, state, update } }
          : { status: 'unavailable' }
      }
      const thirdSeparator = encoded.indexOf(':', secondSeparator + 1)
      if (thirdSeparator < 1) return { status: 'unavailable' }
      const operationId = assertDomainId(
        DOMAIN_ID_KIND.operation,
        encoded.slice(secondSeparator + 1, thirdSeparator),
      )
      const update = decodeBase64(encoded.slice(thirdSeparator + 1))
      return updateWithinLimit(kind, update)
        ? { status: 'available', entry: { generation, operationId, state, update } }
        : { status: 'unavailable' }
    } catch {
      return { status: 'unavailable' }
    }
  }
  const replace = (
    state: 'pending' | 'recovery',
    generation: ContentGeneration,
    update: Uint8Array,
    operationId?: OperationId,
  ): YjsUpdateOutboxWriteResult => {
    if (!storage || !updateWithinLimit(kind, update) || (state === 'recovery' && !operationId)) {
      return { status: 'unavailable' }
    }
    try {
      storage.setItem(
        key,
        `${state}:${generation}:${operationId ? `${operationId}:` : ''}${encodeBase64(update)}`,
      )
      return { status: 'accepted' }
    } catch {
      return { status: 'unavailable' }
    }
  }
  return {
    clear: () => {
      if (!storage) return { status: 'unavailable' }
      try {
        storage.removeItem(key)
        return { status: 'accepted' }
      } catch {
        return { status: 'unavailable' }
      }
    },
    load,
    merge: (generation, update) => {
      try {
        const current = load()
        if (current.status === 'unavailable') return current
        if (
          current.entry &&
          (current.entry.generation !== generation || current.entry.state !== 'pending')
        ) {
          return { status: 'generation_conflict' }
        }
        const merged = current.entry
          ? Y.mergeUpdates([current.entry.update, update])
          : Uint8Array.from(update)
        return replace('pending', generation, merged)
      } catch {
        return { status: 'unavailable' }
      }
    },
    preserve: (generation, operationId, update) =>
      replace('recovery', generation, update, operationId),
    replace: (generation, update) => replace('pending', generation, update),
  }
}

function updateWithinLimit(kind: 'canvas' | 'note', update: Uint8Array): boolean {
  return kind === 'note'
    ? noteYjsEncodedBytesWithinLimit(update)
    : update.byteLength <= CANVAS_WORKLOAD_LIMITS.encodedBytes
}

function browserSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function encodeBase64(update: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < update.byteLength; offset += 8192) {
    binary += String.fromCharCode(...update.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

function decodeBase64(encoded: string): Uint8Array {
  const binary = atob(encoded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
