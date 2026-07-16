import { describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasDocumentDoc, getCanvasDocumentMaps } from '../../canvas/document-contract'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createInMemoryCanvasSession } from '../in-memory-canvas-session'
import * as Y from 'yjs'

describe('createInMemoryCanvasSession', () => {
  it('advances canonical edits and rejects invalid document state', async () => {
    const document = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const initial = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
    const changed = vi.fn()
    const session = createInMemoryCanvasSession(document, initial, changed)
    const nodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    getCanvasDocumentMaps(document).nodesMap.set(nodeId, {
      id: nodeId,
      type: 'text',
      position: { x: 1, y: 2 },
      data: {},
    })

    await expect(session.flush()).resolves.toMatchObject({
      status: 'completed',
      version: { revision: 2 },
    })
    expect(changed).toHaveBeenCalledWith(session)

    document.getMap('nodes').set('not-a-canvas-node-id', {
      id: 'not-a-canvas-node-id',
      type: 'text',
      position: { x: 3, y: 4 },
      data: {},
    })
    await expect(session.flush()).resolves.toEqual({
      status: 'rejected',
      reason: 'content_corrupt',
    })
    session.dispose()
  })
})
