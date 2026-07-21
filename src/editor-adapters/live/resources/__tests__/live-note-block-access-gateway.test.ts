import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLiveNoteBlockAccessGateway } from '../live-note-block-access-gateway'

const campaignId = testDomainId('campaign', 'live-block-access')
const noteId = testDomainId('resource', 'live-block-access')
const blockId = testDomainId('noteBlock', 'live-block-access')
const memberId = testDomainId('campaignMember', 'live-block-access')
const operationId = testDomainId('operation', 'live-block-access')

describe('createLiveNoteBlockAccessGateway', () => {
  it('normalizes one canonical command path and validates its receipt', async () => {
    const execute = vi.fn(() =>
      Promise.resolve({
        status: 'completed' as const,
        receipt: { campaignId, operationId, noteId, blockIds: [blockId] },
      }),
    )
    const gateway = createLiveNoteBlockAccessGateway(campaignId, execute, () => () => undefined)

    await expect(
      gateway.execute({
        campaignId,
        operationId,
        command: {
          type: 'setNoteBlockMemberAccess',
          noteId,
          blockIds: [blockId, blockId],
          memberId,
          permission: 'view',
        },
      }),
    ).resolves.toEqual({
      status: 'received',
      result: {
        status: 'completed',
        receipt: { campaignId, operationId, noteId, blockIds: [blockId] },
      },
    })
    expect(execute).toHaveBeenCalledWith({
      campaignId,
      operationId,
      command: {
        type: 'setNoteBlockMemberAccess',
        noteId,
        blockIds: [blockId],
        memberId,
        permission: 'view',
      },
    })
  })

  it('owns one live presentation subscription and disposes it', () => {
    const dispose = vi.fn()
    let publish:
      | ((value: {
          presentation: ReturnType<typeof pagePresentation> | null
          cursor: string | null
        }) => void)
      | undefined
    const watch = vi.fn((_noteId, _blockIds, _cursor, apply) => {
      publish = apply
      return dispose
    })
    const gateway = createLiveNoteBlockAccessGateway(campaignId, vi.fn(), watch)
    const listener = vi.fn()
    const unsubscribe = gateway.subscribe(noteId, [blockId], listener)

    publish?.({
      cursor: null,
      presentation: pagePresentation(memberId),
    })

    expect(watch).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledOnce()
    expect(gateway.getPresentation(noteId, [blockId])).toMatchObject({
      state: 'known',
      value: { noteId, blocks: [{ blockId }], participantsComplete: true },
    })
    unsubscribe()
    expect(dispose).toHaveBeenCalledOnce()
    expect(gateway.getPresentation(noteId, [blockId])).toEqual({ state: 'unknown' })
    gateway.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('merges participant pages for one normalized block selection', () => {
    const publishes: Array<
      (value: {
        presentation: ReturnType<typeof pagePresentation> | null
        cursor: string | null
      }) => void
    > = []
    const disposes = [vi.fn(), vi.fn()]
    const watch = vi.fn((_noteId, _blockIds, _cursor, apply) => {
      const index = publishes.push(apply) - 1
      return disposes[index]!
    })
    const gateway = createLiveNoteBlockAccessGateway(campaignId, vi.fn(), watch)
    const unsubscribe = gateway.subscribe(noteId, [blockId, blockId], vi.fn())
    publishes[0]!({ presentation: pagePresentation(memberId), cursor: 'next' })
    gateway.loadMorePresentation(noteId, [blockId])
    const secondMemberId = testDomainId('campaignMember', 'live-block-access-second')
    publishes[1]!({ presentation: pagePresentation(secondMemberId), cursor: null })

    expect(watch.mock.calls.map((call) => call.slice(0, 3))).toEqual([
      [noteId, [blockId], null],
      [noteId, [blockId], 'next'],
    ])
    expect(gateway.getPresentation(noteId, [blockId])).toMatchObject({
      state: 'known',
      value: {
        participants: [{ id: memberId }, { id: secondMemberId }],
        blocks: [
          {
            blockId,
            memberAccess: [{ memberId }, { memberId: secondMemberId }],
          },
        ],
        participantsComplete: true,
      },
    })
    unsubscribe()
    expect(disposes[0]).toHaveBeenCalledOnce()
    expect(disposes[1]).toHaveBeenCalledOnce()
  })
})

function pagePresentation(participantId: typeof memberId) {
  return {
    noteId,
    blocks: [
      {
        blockId,
        audienceVisibility: 'hidden' as const,
        memberAccess: [{ memberId: participantId, visibility: 'visible' as const }],
      },
    ],
    participants: [
      {
        id: participantId,
        displayName: 'Player',
        username: 'player',
        imageUrl: null,
        notePermission: 'view' as const,
      },
    ],
  }
}
