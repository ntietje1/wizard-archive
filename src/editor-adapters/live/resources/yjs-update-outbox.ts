import * as Y from 'yjs'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { assertContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'

const MAX_YJS_OUTBOX_UPDATE_BYTES = 512 * 1024

type YjsUpdateOutboxUnavailable = Readonly<{ status: 'unavailable' }>
type YjsUpdateOutboxReadResult =
  | Readonly<{
      status: 'available'
      entry: Readonly<{ generation: ContentGeneration; update: Uint8Array }> | null
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
  const key = `wizard-archive:${kind}-update-outbox:v2:${memberId}:${campaignId}:${resourceId}`
  const load = (): YjsUpdateOutboxReadResult => {
    if (!storage) return { status: 'unavailable' }
    try {
      const encoded = storage.getItem(key)
      if (encoded === null) return { status: 'available', entry: null }
      const separator = encoded.indexOf(':')
      if (separator < 1) return { status: 'unavailable' }
      const generation = assertContentGeneration(Number(encoded.slice(0, separator)))
      const update = decodeBase64(encoded.slice(separator + 1))
      return update.byteLength <= MAX_YJS_OUTBOX_UPDATE_BYTES
        ? { status: 'available', entry: { generation, update } }
        : { status: 'unavailable' }
    } catch {
      return { status: 'unavailable' }
    }
  }
  const replace = (
    generation: ContentGeneration,
    update: Uint8Array,
  ): YjsUpdateOutboxWriteResult => {
    if (!storage || update.byteLength > MAX_YJS_OUTBOX_UPDATE_BYTES) {
      return { status: 'unavailable' }
    }
    try {
      storage.setItem(key, `${generation}:${encodeBase64(update)}`)
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
        if (current.entry && current.entry.generation !== generation) {
          return { status: 'generation_conflict' }
        }
        const merged = current.entry
          ? Y.mergeUpdates([current.entry.update, update])
          : Uint8Array.from(update)
        return replace(generation, merged)
      } catch {
        return { status: 'unavailable' }
      }
    },
    replace,
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
