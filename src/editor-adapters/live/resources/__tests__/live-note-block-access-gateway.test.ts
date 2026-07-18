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
    const gateway = createLiveNoteBlockAccessGateway(campaignId, execute, null)

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
      | ((
          value: {
            noteId: string
            blocks: Array<{
              blockId: typeof blockId
              audienceVisibility: 'hidden' | 'visible'
              memberAccess: Array<{
                memberId: typeof memberId
                visibility: 'hidden' | 'visible'
              }>
            }>
            participants: Array<{
              id: typeof memberId
              displayName: string
              username: string
              imageUrl: string | null
              notePermission: 'none' | 'view' | 'edit'
            }>
          } | null,
        ) => void)
      | undefined
    const watch = vi.fn((_noteId, apply) => {
      publish = apply
      return dispose
    })
    const gateway = createLiveNoteBlockAccessGateway(campaignId, vi.fn(), watch)
    const listener = vi.fn()
    gateway.subscribe(noteId, listener)

    gateway.loadPresentation(noteId)
    gateway.loadPresentation(noteId)
    publish?.({
      noteId,
      blocks: [{ blockId, audienceVisibility: 'hidden', memberAccess: [] }],
      participants: [
        {
          id: memberId,
          displayName: 'Player',
          username: 'player',
          imageUrl: null,
          notePermission: 'view',
        },
      ],
    })

    expect(watch).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledOnce()
    expect(gateway.getPresentation(noteId)).toMatchObject({
      state: 'known',
      value: { noteId, blocks: [{ blockId }] },
    })
    gateway.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('rejects mutation when the capability is not authoritative', async () => {
    const gateway = createLiveNoteBlockAccessGateway(campaignId, null, null)
    await expect(
      gateway.execute({
        campaignId,
        operationId,
        command: {
          type: 'setNoteBlockAudienceAccess',
          noteId,
          blockIds: [blockId],
          shared: true,
        },
      }),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'unauthorized' },
    })
  })
})
