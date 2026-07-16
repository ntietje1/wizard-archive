import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { LiveResourceAwarenessBackend } from '../live-resource-awareness'
import { createLiveResourceAwareness } from '../live-resource-awareness'
import { authenticateResourceAwarenessUpdate } from 'shared/resources/resource-awareness-protocol'

describe('LiveResourceAwareness', () => {
  afterEach(() => vi.useRealTimers())

  it('projects remote collaborators through the session-owned provider', async () => {
    const document = new Y.Doc()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const memberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const remoteMemberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    let apply: Parameters<LiveResourceAwarenessBackend['watchAwareness']>[1] | undefined
    const publishAwareness = vi.fn(() => Promise.resolve({ status: 'active' as const }))
    const releaseAwareness = vi.fn(() => Promise.resolve({ status: 'released' as const }))
    const unsubscribe = vi.fn()
    const collaboratorsChanged = vi.fn()
    const collaboration = createLiveResourceAwareness(
      document,
      resourceId,
      memberId,
      { name: 'Local', color: '#61afef' },
      {
        publishAwareness,
        releaseAwareness,
        watchAwareness: (_resourceId, listener) => {
          apply = listener
          return unsubscribe
        },
      },
      collaboratorsChanged,
    )

    expect(collaboratorsChanged).not.toHaveBeenCalled()
    expect(collaboration.awareness).toEqual({ status: 'unavailable' })
    await collaboration.flush()
    expect(publishAwareness).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId, clientId: document.clientID }),
    )

    const remoteDocument = new Y.Doc()
    const remoteAwareness = new Awareness(remoteDocument)
    remoteAwareness.setLocalStateField('user', { name: 'Remote', color: '#e06c75' })
    const remoteState = authenticateResourceAwarenessUpdate(
      Uint8Array.from(encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID])).buffer,
      remoteDocument.clientID,
      remoteMemberId,
      { name: 'Remote', color: '#e06c75' },
    )
    expect(remoteState.status).toBe('accepted')
    if (remoteState.status !== 'accepted') throw new Error('Expected valid awareness state')
    apply?.({
      status: 'ready',
      entries: [
        {
          clientId: remoteDocument.clientID,
          memberId: remoteMemberId,
          state: remoteState.update,
        },
      ],
    })

    expect(collaboration.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId, remoteMemberId],
    })
    expect(collaboratorsChanged).toHaveBeenCalledTimes(2)
    expect(
      collaboration.collaboration.provider.awareness.getStates().get(remoteDocument.clientID),
    ).toEqual({
      memberId: remoteMemberId,
      user: { name: 'Remote', color: '#e06c75' },
    })

    apply?.({ status: 'ready', entries: [] })
    expect(collaboration.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId],
    })
    expect(collaboratorsChanged).toHaveBeenCalledTimes(3)

    await collaboration.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(releaseAwareness).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId, clientId: document.clientID }),
    )
    remoteAwareness.destroy()
    remoteDocument.destroy()
    document.destroy()
  })

  it('renews the awareness lease after a disconnected publish', async () => {
    vi.useFakeTimers()
    const document = new Y.Doc()
    const publishAwareness = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ status: 'active' as const })
    const collaboration = createLiveResourceAwareness(
      document,
      generateDomainId(DOMAIN_ID_KIND.resource),
      generateDomainId(DOMAIN_ID_KIND.campaignMember),
      { name: 'Local', color: '#61afef' },
      {
        publishAwareness,
        releaseAwareness: () => Promise.resolve({ status: 'released' as const }),
        watchAwareness: () => () => {},
      },
      vi.fn(),
    )

    await collaboration.flush()
    expect(publishAwareness).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(publishAwareness).toHaveBeenCalledTimes(2)

    await collaboration.dispose()
    document.destroy()
  })

  it('ignores malformed and identity-spoofed subscriber entries', async () => {
    const document = new Y.Doc()
    const remoteDocument = new Y.Doc()
    const remoteAwareness = new Awareness(remoteDocument)
    const remoteMemberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const differentMemberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    remoteAwareness.setLocalStateField('user', { name: 'Remote', color: '#e06c75' })
    const authenticated = authenticateResourceAwarenessUpdate(
      Uint8Array.from(encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID])).buffer,
      remoteDocument.clientID,
      remoteMemberId,
      { name: 'Remote', color: '#e06c75' },
    )
    if (authenticated.status !== 'accepted') throw new Error('Expected valid awareness state')
    let apply: Parameters<LiveResourceAwarenessBackend['watchAwareness']>[1] | undefined
    const collaboration = createLiveResourceAwareness(
      document,
      generateDomainId(DOMAIN_ID_KIND.resource),
      generateDomainId(DOMAIN_ID_KIND.campaignMember),
      { name: 'Local', color: '#61afef' },
      {
        publishAwareness: () => Promise.resolve({ status: 'active' }),
        releaseAwareness: () => Promise.resolve({ status: 'released' }),
        watchAwareness: (_resourceId, listener) => {
          apply = listener
          return () => {}
        },
      },
      vi.fn(),
    )

    expect(() =>
      apply?.({
        status: 'ready',
        entries: [
          {
            clientId: remoteDocument.clientID,
            memberId: remoteMemberId,
            state: new ArrayBuffer(1),
          },
          {
            clientId: remoteDocument.clientID,
            memberId: differentMemberId,
            state: authenticated.update,
          },
        ],
      }),
    ).not.toThrow()
    expect(
      collaboration.collaboration.provider.awareness.getStates().has(remoteDocument.clientID),
    ).toBe(false)

    await collaboration.dispose()
    remoteAwareness.destroy()
    remoteDocument.destroy()
    document.destroy()
  })

  it.each([
    { status: 'unavailable' as const },
    { status: 'rejected' as const, reason: 'lease_conflict' },
  ])('does not heartbeat after a $status publish result', async (result) => {
    vi.useFakeTimers()
    const document = new Y.Doc()
    const publishAwareness = vi.fn(() => Promise.resolve(result))
    const collaboration = createLiveResourceAwareness(
      document,
      generateDomainId(DOMAIN_ID_KIND.resource),
      generateDomainId(DOMAIN_ID_KIND.campaignMember),
      { name: 'Local', color: '#61afef' },
      {
        publishAwareness,
        releaseAwareness: () => Promise.resolve({ status: 'released' }),
        watchAwareness: () => () => {},
      },
      vi.fn(),
    )

    await collaboration.flush()
    expect(collaboration.awareness).toEqual({ status: 'unavailable' })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(publishAwareness).toHaveBeenCalledOnce()

    await collaboration.dispose()
    document.destroy()
  })
})
