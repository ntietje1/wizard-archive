import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { testOperationId } from '../../../../../shared/test/operation-id'
import { testResourceId } from '../../../../../shared/test/resource-id'
import { createLiveResourceContentSource } from '../live-resource-content-source'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadContent>

const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: 'a'.repeat(64),
}

describe('LiveResourceContentSource', () => {
  it('keeps loading, initializing, ready, unavailable, and integrity states distinct', () => {
    const resourceId = testResourceId('file-content')
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
    const operationId = testOperationId('file-copy')
    apply({ status: 'initializing', operationId })
    expect(source.get(resourceId)).toEqual({ status: 'initializing', operationId, local: null })

    const content = {
      assetId: null,
      extension: 'txt',
      mediaType: 'text/plain',
      originalName: 'notes.txt',
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
    const resourceId = testResourceId('canvas-content')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const source = createLiveResourceContentSource('canvas', {
      watch: (_resourceId, update) => {
        apply = update
        return () => undefined
      },
    })
    const update = Y.encodeStateAsUpdate(new Y.Doc())

    source.get(resourceId)
    apply({ status: 'ready', kind: 'canvas', update: update.buffer as ArrayBuffer, version })
    expect(source.get(resourceId)).toEqual({
      status: 'ready',
      content: expect.any(Y.Doc),
      version,
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

    source.dispose()
  })
})
