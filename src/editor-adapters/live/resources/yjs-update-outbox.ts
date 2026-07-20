import * as Y from 'yjs'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { assertContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'

const MAX_YJS_PENDING_UPDATE_BYTES = 512 * 1024
const MAX_YJS_RECOVERY_UPDATE_BYTES = 768 * 1024

type YjsUpdateOutboxUnavailable = Readonly<{ status: 'unavailable' }>
type YjsUpdateOutboxReadResult =
  | Readonly<{
      status: 'available'
      entry: Readonly<{
        generation: ContentGeneration
        state: 'pending' | 'recovery'
        update: Uint8Array
      }> | null
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
  preserve(generation: ContentGeneration, update: Uint8Array): YjsUpdateOutboxWriteResult
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
  const key = `wizard-archive:${kind}-update-outbox:v3:${memberId}:${campaignId}:${resourceId}`
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
      const update = decodeBase64(encoded.slice(secondSeparator + 1))
      const limit =
        state === 'recovery' ? MAX_YJS_RECOVERY_UPDATE_BYTES : MAX_YJS_PENDING_UPDATE_BYTES
      return update.byteLength <= limit
        ? { status: 'available', entry: { generation, state, update } }
        : { status: 'unavailable' }
    } catch {
      return { status: 'unavailable' }
    }
  }
  const replace = (
    state: 'pending' | 'recovery',
    generation: ContentGeneration,
    update: Uint8Array,
  ): YjsUpdateOutboxWriteResult => {
    const limit =
      state === 'recovery' ? MAX_YJS_RECOVERY_UPDATE_BYTES : MAX_YJS_PENDING_UPDATE_BYTES
    if (!storage || update.byteLength > limit) {
      return { status: 'unavailable' }
    }
    try {
      storage.setItem(key, `${state}:${generation}:${encodeBase64(update)}`)
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
    preserve: (generation, update) => replace('recovery', generation, update),
    replace: (generation, update) => replace('pending', generation, update),
  }
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
