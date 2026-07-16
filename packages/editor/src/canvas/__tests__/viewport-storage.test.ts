import { describe, expect, it } from 'vite-plus/test'
import { loadCanvasViewport, saveCanvasViewport } from '../viewport-storage'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const RESOURCE_ID = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-444444444444')

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('canvas viewport storage', () => {
  it('round-trips a viewport under the canonical resource id', () => {
    const storage = memoryStorage()
    saveCanvasViewport(storage, RESOURCE_ID, { x: 64, y: -32, zoom: 2 })
    expect(loadCanvasViewport(storage, RESOURCE_ID)).toEqual({ x: 64, y: -32, zoom: 2 })
  })

  it('rejects malformed, partial, and out-of-range viewport state', () => {
    const storage = memoryStorage()
    storage.setItem(
      `wizard-archive:canvas-viewport:v1:${RESOURCE_ID}`,
      JSON.stringify({ x: 10, y: 20, zoom: 9 }),
    )
    expect(loadCanvasViewport(storage, RESOURCE_ID)).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('reports unavailable storage without breaking viewport interaction', () => {
    expect(() =>
      saveCanvasViewport(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('unavailable')
          },
        },
        RESOURCE_ID,
        { x: 0, y: 0, zoom: 1 },
      ),
    ).not.toThrow()
  })
})
