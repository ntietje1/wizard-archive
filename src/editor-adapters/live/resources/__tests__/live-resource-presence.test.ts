import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { LiveResourcePresenceBackend } from '../live-resource-presence'
import { createLiveResourcePresence } from '../live-resource-presence'

const activeSession = {
  status: 'active' as const,
  roomToken: 'room-token',
  sessionToken: 'session-token',
}

function backend(overrides: Partial<LiveResourcePresenceBackend> = {}) {
  return {
    heartbeatPresence: vi.fn(() => Promise.resolve(activeSession)),
    updatePresence: vi.fn(() => Promise.resolve({ status: 'active' as const })),
    disconnectPresence: vi.fn(() => Promise.resolve({ status: 'released' as const })),
    watchPresence: vi.fn(() => () => undefined),
    ...overrides,
  } satisfies LiveResourcePresenceBackend
}

describe('LiveResourcePresence', () => {
  afterEach(() => vi.useRealTimers())

  it('projects and removes remote collaborators through one session-owned provider', async () => {
    const document = new Y.Doc()
    const remoteDocument = new Y.Doc()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const memberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const remoteMemberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const remoteAwareness = new Awareness(remoteDocument)
    remoteAwareness.setLocalState({
      memberId: 'spoofed',
      user: { name: 'Spoofed', color: '#000000' },
    })
    let apply: Parameters<LiveResourcePresenceBackend['watchPresence']>[2] | undefined
    const unsubscribe = vi.fn()
    const provider = backend({
      watchPresence: vi.fn((_resourceId, _roomToken, listener) => {
        apply = listener
        return unsubscribe
      }),
    })
    const collaboratorsChanged = vi.fn()
    const presence = createLiveResourcePresence(
      document,
      resourceId,
      memberId,
      { name: 'Local', color: '#61afef' },
      provider,
      collaboratorsChanged,
    )

    await presence.flush()
    expect(presence.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId],
    })
    expect(provider.watchPresence).toHaveBeenCalledWith(
      resourceId,
      'room-token',
      expect.any(Function),
    )

    apply?.({
      status: 'ready',
      entries: [
        {
          clientId: remoteDocument.clientID === 0xffff_ffff ? 0 : remoteDocument.clientID + 1,
          memberId: remoteMemberId,
          state: new ArrayBuffer(1),
          user: { name: 'Ignored', color: '#000000' },
        },
        {
          clientId: remoteDocument.clientID,
          memberId: remoteMemberId,
          state: Uint8Array.from(encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID]))
            .buffer,
          user: { name: 'Remote', color: '#e06c75' },
        },
      ],
    })

    expect(presence.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId, remoteMemberId],
    })
    expect(
      presence.collaboration.provider.awareness.getStates().get(remoteDocument.clientID),
    ).toEqual({
      memberId: remoteMemberId,
      user: { name: 'Remote', color: '#e06c75' },
    })

    apply?.({ status: 'ready', entries: [] })
    expect(presence.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId],
    })

    apply?.({
      status: 'ready',
      entries: [
        {
          clientId: remoteDocument.clientID,
          memberId: remoteMemberId,
          state: Uint8Array.from(encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID]))
            .buffer,
          user: { name: 'Remote', color: '#e06c75' },
        },
      ],
    })
    expect(presence.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId, remoteMemberId],
    })

    await presence.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(provider.disconnectPresence).toHaveBeenCalledWith({
      resourceId,
      sessionToken: 'session-token',
    })
    remoteAwareness.destroy()
    remoteDocument.destroy()
    document.destroy()
  })

  it('coalesces pointer-frequency updates into one coarse presence mutation', async () => {
    vi.useFakeTimers()
    const document = new Y.Doc()
    const updatePresence = vi.fn(() => Promise.resolve({ status: 'active' as const }))
    const provider = backend({ updatePresence })
    const presence = createLiveResourcePresence(
      document,
      generateDomainId(DOMAIN_ID_KIND.resource),
      generateDomainId(DOMAIN_ID_KIND.campaignMember),
      { name: 'Local', color: '#61afef' },
      provider,
      vi.fn(),
    )
    await presence.flush()
    updatePresence.mockClear()

    for (let index = 0; index < 100; index += 1) {
      presence.collaboration.provider.awareness.setLocalStateField('cursor', { x: index, y: index })
    }
    await vi.advanceTimersByTimeAsync(249)
    expect(updatePresence).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(updatePresence).toHaveBeenCalledOnce()

    await presence.dispose()
    document.destroy()
  })

  it('reconnects through the component heartbeat after a transport failure', async () => {
    vi.useFakeTimers()
    const document = new Y.Doc()
    const heartbeatPresence = vi
      .fn<LiveResourcePresenceBackend['heartbeatPresence']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(activeSession)
    const presence = createLiveResourcePresence(
      document,
      generateDomainId(DOMAIN_ID_KIND.resource),
      generateDomainId(DOMAIN_ID_KIND.campaignMember),
      { name: 'Local', color: '#61afef' },
      backend({ heartbeatPresence }),
      vi.fn(),
    )

    await vi.advanceTimersByTimeAsync(10_000)
    expect(heartbeatPresence).toHaveBeenCalledTimes(2)
    expect(presence.awareness.status).toBe('available')

    await presence.dispose()
    document.destroy()
  })

  it.each([
    { status: 'unavailable' as const },
    { status: 'rejected' as const, reason: 'invalid_client' },
  ])('stops after a terminal $status heartbeat result', async (result) => {
    vi.useFakeTimers()
    const document = new Y.Doc()
    const heartbeatPresence = vi.fn(() => Promise.resolve(result))
    const presence = createLiveResourcePresence(
      document,
      generateDomainId(DOMAIN_ID_KIND.resource),
      generateDomainId(DOMAIN_ID_KIND.campaignMember),
      { name: 'Local', color: '#61afef' },
      backend({ heartbeatPresence }),
      vi.fn(),
    )

    await presence.flush()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(heartbeatPresence).toHaveBeenCalledOnce()
    expect(presence.awareness).toEqual({ status: 'unavailable' })

    await presence.dispose()
    document.destroy()
  })
})
