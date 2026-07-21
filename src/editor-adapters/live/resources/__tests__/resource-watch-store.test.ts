import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import {
  createResourceSubscriptionRetainer,
  createResourceWatchStore,
} from '../resource-watch-store'

describe('resource watch ownership', () => {
  it('owns one watch and one decoded state across every consumer', () => {
    const resourceId = testDomainId('resource', 'shared-watch-resource')
    const stop = vi.fn()
    const releaseState = vi.fn()
    let publish: (snapshot: number) => void = () => undefined
    let store: ReturnType<typeof createResourceWatchStore<number, number>>
    store = createResourceWatchStore<number, number>(
      (_resourceId, apply) => {
        publish = apply
        return stop
      },
      (id, snapshot) => store.set(id, snapshot),
      0,
      { releaseState },
    )

    const releaseFirst = store.subscribe(resourceId, () => undefined)
    const releaseSecond = store.subscribe(resourceId, () => undefined)
    publish(2)
    expect(store.get(resourceId)).toBe(2)

    releaseFirst()
    expect(stop).not.toHaveBeenCalled()
    expect(releaseState).not.toHaveBeenCalled()
    releaseSecond()
    expect(stop).toHaveBeenCalledOnce()
    expect(releaseState).toHaveBeenCalledWith(resourceId)
    expect(store.get(resourceId)).toBe(0)
  })

  it('attaches one derived session until its last consumer releases it', () => {
    const resourceId = testDomainId('resource', 'retained-session-resource')
    const stop = vi.fn()
    const start = vi.fn(() => stop)
    const released = vi.fn()
    const retainer = createResourceSubscriptionRetainer(start, released)

    const releaseFirst = retainer.retain(resourceId)
    const releaseSecond = retainer.retain(resourceId)
    expect(start).toHaveBeenCalledOnce()

    releaseFirst()
    expect(stop).not.toHaveBeenCalled()
    releaseSecond()
    expect(stop).toHaveBeenCalledOnce()
    expect(released).toHaveBeenCalledWith(resourceId)
  })
})
