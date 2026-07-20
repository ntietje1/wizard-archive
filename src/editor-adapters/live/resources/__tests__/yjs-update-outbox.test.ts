import * as Y from 'yjs'
import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import {
  advanceContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import { createYjsUpdateOutbox } from '../yjs-update-outbox'

class QuotaStorage {
  readonly #entries = new Map<string, string>()

  constructor(private readonly quota: number = Number.POSITIVE_INFINITY) {}

  getItem(key: string): string | null {
    return this.#entries.get(key) ?? null
  }

  removeItem(key: string): void {
    this.#entries.delete(key)
  }

  setItem(key: string, value: string): void {
    const used = [...this.#entries.entries()].reduce(
      (total, [entryKey, entry]) => total + (entryKey === key ? 0 : entry.length),
      value.length,
    )
    if (used > this.quota) throw new Error('quota exceeded')
    this.#entries.set(key, value)
  }
}

function updateWithText(key: string, length: number): Uint8Array {
  const document = new Y.Doc()
  document.getMap('content').set(key, 'x'.repeat(length))
  const update = Y.encodeStateAsUpdate(document)
  document.destroy()
  return update
}

function outbox(
  storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>,
  kind: 'canvas' | 'note',
  resource: string,
) {
  return createYjsUpdateOutbox(
    kind,
    testDomainId('campaign', 'outbox-campaign'),
    testDomainId('resource', resource),
    testDomainId('campaignMember', 'outbox-member'),
    storage,
  )
}

describe('YjsUpdateOutbox', () => {
  it('merges, replaces, reloads, and clears one resource-owned pending update', () => {
    const storage = new QuotaStorage()
    const first = updateWithText('first', 10)
    const second = updateWithText('second', 10)
    const ledger = outbox(storage, 'note', 'note')

    expect(ledger.load()).toEqual({ status: 'available', entry: null })
    expect(ledger.merge(INITIAL_CONTENT_GENERATION, first)).toMatchObject({
      status: 'accepted',
    })
    expect(ledger.merge(INITIAL_CONTENT_GENERATION, second)).toMatchObject({
      status: 'accepted',
    })

    const recovered = outbox(storage, 'note', 'note').load()
    if (recovered.status !== 'available' || !recovered.entry) {
      throw new Error('Expected a recovered update')
    }
    const document = new Y.Doc()
    Y.applyUpdate(document, recovered.entry.update)
    expect(document.getMap('content').toJSON()).toEqual({
      first: 'x'.repeat(10),
      second: 'x'.repeat(10),
    })
    document.destroy()

    expect(ledger.replace(INITIAL_CONTENT_GENERATION, first)).toEqual({ status: 'accepted' })
    expect(ledger.clear()).toEqual({ status: 'accepted' })
    expect(ledger.load()).toEqual({ status: 'available', entry: null })
  })

  it('keeps accepted updates isolated to their observed content generation', () => {
    const storage = new QuotaStorage()
    const ledger = outbox(storage, 'note', 'generation')
    const update = updateWithText('pending', 10)

    expect(ledger.merge(INITIAL_CONTENT_GENERATION, update)).toEqual({ status: 'accepted' })
    expect(ledger.merge(advanceContentGeneration(INITIAL_CONTENT_GENERATION), update)).toEqual({
      status: 'generation_conflict',
    })
    expect(ledger.load()).toMatchObject({
      status: 'available',
      entry: { generation: INITIAL_CONTENT_GENERATION },
    })
  })

  it('freezes one complete recovery artifact that pending updates cannot mutate', () => {
    const storage = new QuotaStorage()
    const ledger = outbox(storage, 'note', 'recovery')
    const pending = updateWithText('pending', 10)
    const complete = updateWithText('complete', 20)
    const operationId = testDomainId('operation', 'recovery')

    expect(ledger.merge(INITIAL_CONTENT_GENERATION, pending)).toEqual({ status: 'accepted' })
    expect(ledger.preserve(INITIAL_CONTENT_GENERATION, operationId, complete)).toEqual({
      status: 'accepted',
    })
    expect(ledger.load()).toMatchObject({
      status: 'available',
      entry: {
        generation: INITIAL_CONTENT_GENERATION,
        operationId,
        state: 'recovery',
        update: { byteLength: complete.byteLength },
      },
    })
    expect(ledger.merge(INITIAL_CONTENT_GENERATION, pending)).toEqual({
      status: 'generation_conflict',
    })
  })

  it('reports storage and malformed-update failures instead of throwing', () => {
    const unavailable = {
      getItem: () => {
        throw new Error('security denied')
      },
      removeItem: () => {
        throw new Error('security denied')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    const ledger = outbox(unavailable, 'canvas', 'unavailable')

    expect(ledger.load()).toEqual({ status: 'unavailable' })
    expect(ledger.replace(INITIAL_CONTENT_GENERATION, updateWithText('value', 1))).toEqual({
      status: 'unavailable',
    })
    expect(ledger.merge(INITIAL_CONTENT_GENERATION, new Uint8Array([255]))).toEqual({
      status: 'unavailable',
    })
    expect(ledger.clear()).toEqual({ status: 'unavailable' })
    expect(ledger.replace(INITIAL_CONTENT_GENERATION, new Uint8Array(600_000))).toEqual({
      status: 'unavailable',
    })
    const canvasRecovery = outbox(new QuotaStorage(), 'canvas', 'larger-recovery')
    expect(
      canvasRecovery.preserve(
        INITIAL_CONTENT_GENERATION,
        testDomainId('operation', 'canvas-larger-recovery'),
        new Uint8Array(600_000),
      ),
    ).toEqual({
      status: 'unavailable',
    })
    const noteRecovery = outbox(new QuotaStorage(), 'note', 'larger-recovery')
    expect(
      noteRecovery.preserve(
        INITIAL_CONTENT_GENERATION,
        testDomainId('operation', 'note-larger-recovery'),
        new Uint8Array(800_023),
      ),
    ).toEqual({
      status: 'accepted',
    })
    expect(noteRecovery.load()).toMatchObject({
      status: 'available',
      entry: { state: 'recovery', update: { byteLength: 800_023 } },
    })
  })

  it('keeps near-limit sessions independent when aggregate storage is exhausted', () => {
    const update = updateWithText('near-limit', 330_000)
    const storage = new QuotaStorage(1_300_000)
    const first = outbox(storage, 'note', 'first-near-limit')
    const second = outbox(storage, 'canvas', 'second-near-limit')
    const exhausted = outbox(storage, 'note', 'exhausted-near-limit')

    expect(first.replace(INITIAL_CONTENT_GENERATION, update)).toEqual({ status: 'accepted' })
    expect(second.replace(INITIAL_CONTENT_GENERATION, update)).toEqual({ status: 'accepted' })
    expect(exhausted.replace(INITIAL_CONTENT_GENERATION, update)).toEqual({
      status: 'unavailable',
    })
    expect(first.load()).toMatchObject({
      status: 'available',
      entry: { generation: INITIAL_CONTENT_GENERATION, update: { byteLength: update.byteLength } },
    })
    expect(second.load()).toMatchObject({
      status: 'available',
      entry: { generation: INITIAL_CONTENT_GENERATION, update: { byteLength: update.byteLength } },
    })
    expect(exhausted.load()).toEqual({ status: 'available', entry: null })
  })
})
