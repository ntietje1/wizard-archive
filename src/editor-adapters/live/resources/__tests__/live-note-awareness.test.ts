import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { LiveNoteAwarenessBackend } from '../live-note-awareness'
import { createLiveNoteAwareness } from '../live-note-awareness'

describe('LiveNoteAwareness', () => {
  afterEach(() => vi.useRealTimers())

  it('projects remote collaborators through the session-owned provider', async () => {
    const document = new Y.Doc()
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const memberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const remoteMemberId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    let apply: Parameters<LiveNoteAwarenessBackend['watchAwareness']>[1] | undefined
    const publishAwareness = vi.fn(() => Promise.resolve({ status: 'active' as const }))
    const releaseAwareness = vi.fn(() => Promise.resolve({ status: 'released' as const }))
    const unsubscribe = vi.fn()
    const collaboratorsChanged = vi.fn()
    const collaboration = createLiveNoteAwareness(
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
    await collaboration.flush()
    expect(publishAwareness).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId, clientId: document.clientID }),
    )

    const remoteDocument = new Y.Doc()
    const remoteAwareness = new Awareness(remoteDocument)
    remoteAwareness.setLocalStateField('user', { name: 'Remote', color: '#e06c75' })
    apply?.({
      status: 'ready',
      entries: [
        {
          clientId: remoteDocument.clientID,
          memberId: remoteMemberId,
          state: Uint8Array.from(encodeAwarenessUpdate(remoteAwareness, [remoteDocument.clientID]))
            .buffer,
        },
      ],
    })

    expect(collaboration.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId, remoteMemberId],
    })
    expect(collaboratorsChanged).toHaveBeenCalledOnce()
    expect(
      collaboration.collaboration.provider.awareness.getStates().get(remoteDocument.clientID),
    ).toEqual({ user: { name: 'Remote', color: '#e06c75' } })

    apply?.({ status: 'ready', entries: [] })
    expect(collaboration.awareness).toEqual({
      status: 'available',
      collaboratorIds: [memberId],
    })
    expect(collaboratorsChanged).toHaveBeenCalledTimes(2)

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
    const collaboration = createLiveNoteAwareness(
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
})
