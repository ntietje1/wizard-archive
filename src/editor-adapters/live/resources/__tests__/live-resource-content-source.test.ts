import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { testDomainId } from '../../../../../shared/test/domain-id'
import {
  createLiveMapSessionSource,
  createLiveResourceContentSource,
} from '../live-resource-content-source'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadContent>

const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: 'a'.repeat(64),
}

describe('LiveResourceContentSource', () => {
  it('keeps loading, initializing, ready, unavailable, and integrity states distinct', () => {
    const resourceId = testDomainId('resource', 'file-content')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const unsubscribe = vi.fn()
    const listener = vi.fn()
    const source = createLiveResourceContentSource('file', {
      watch: (_resourceId, update) => {
        apply = update
        return unsubscribe
      },
    })

    expect(source.get(resourceId)).toEqual({ status: 'loading' })
    source.subscribe(resourceId, listener)
    const operationId = testDomainId('operation', 'file-copy')
    apply({ status: 'initializing', operationId })
    expect(source.get(resourceId)).toEqual({ status: 'initializing', operationId })

    const content = {
      assetId: null,
      classification: 'inert_file' as const,
      byteSize: 0,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'application/octet-stream',
      viewerUnavailableReason: 'empty_file' as const,
    }
    apply({ status: 'ready', kind: 'file', content, version })
    expect(source.get(resourceId)).toEqual({ status: 'ready', content, version })
    apply({ status: 'unavailable', reason: 'unauthorized' })
    expect(source.get(resourceId)).toEqual({ status: 'unavailable', reason: 'unauthorized' })
    apply({ status: 'integrity_error', issue: 'content_missing' })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_missing',
    })
    expect(listener).toHaveBeenCalledTimes(4)

    source.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('owns decoded canvas documents and rejects corrupt updates', () => {
    const resourceId = testDomainId('resource', 'canvas-content')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const source = createLiveResourceContentSource('canvas', {
      watch: (_resourceId, update) => {
        apply = update
        return () => undefined
      },
    })
    const update = Y.encodeStateAsUpdate(new Y.Doc())

    const unsubscribe = source.subscribe(resourceId, () => {})
    apply({ status: 'ready', kind: 'canvas', update: update.buffer as ArrayBuffer, version })
    expect(source.get(resourceId)).toEqual({
      status: 'ready',
      session: expect.objectContaining({ document: expect.any(Y.Doc), version }),
    })
    apply({
      status: 'ready',
      kind: 'canvas',
      update: new Uint8Array([255]).buffer,
      version,
    })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_corrupt',
    })

    unsubscribe()
    source.dispose()
  })

  it('rejects a completed kind-owned create with the wrong receipt identity', async () => {
    const campaignId = testDomainId('campaign', 'map-create-campaign')
    const resourceId = testDomainId('resource', 'map-create-resource')
    const operationId = testDomainId('operation', 'map-create-operation')
    const recording = { abandon: vi.fn(), completed: vi.fn() }
    const refresh = vi.fn()
    const source = createLiveMapSessionSource(
      campaignId,
      {
        watch: () => () => undefined,
        create: () =>
          Promise.resolve({
            status: 'completed',
            receipt: {
              campaignId,
              operationId: testDomainId('operation', 'unexpected-operation'),
              result: { type: 'created', resourceId },
              postconditions: [],
            },
          }),
        refresh,
      },
      () => recording,
    )

    await expect(
      source.create({
        campaignId,
        operationId,
        command: {
          type: 'create',
          resourceId,
          kind: 'map',
          parentId: null,
          title: canonicalizeResourceTitle('Map'),
          icon: null,
          color: null,
        },
      }),
    ).resolves.toEqual({
      status: 'not_committed',
      retryable: false,
      reason: 'invalid_response',
    })
    expect(recording.abandon).toHaveBeenCalledOnce()
    expect(recording.completed).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    source.dispose()
  })
})
