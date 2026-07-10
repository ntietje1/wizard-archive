import { beforeEach, describe, expect, it, vi } from 'vitest'
import { projectNoteBlocksFromYjs } from '../internalActions'
import type { Id } from '../../_generated/dataModel'
import type { ActionCtx } from '../../_generated/server'

const yjsUpdatesToBlocks = vi.hoisted(() => vi.fn())

vi.mock('../blocknoteNode', () => ({ yjsUpdatesToBlocks }))

const documentId = 'note-id' as Id<'sidebarItems'>

describe('projectNoteBlocksFromYjs', () => {
  beforeEach(() => {
    yjsUpdatesToBlocks.mockReset()
  })

  it('rejects invalid decoded content without mutating the previous projection', async () => {
    const runQuery = vi.fn().mockResolvedValue([{ seq: 4, update: new ArrayBuffer(1) }])
    const runMutation = vi.fn()
    yjsUpdatesToBlocks.mockImplementation(() => {
      throw new Error('invalid decoded document')
    })

    await expect(
      projectNoteBlocksFromYjs(actionContext(runQuery, runMutation), documentId),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_document' })
    expect(runMutation).not.toHaveBeenCalled()
  })

  it('returns the exact projected update watermark after syncing valid content', async () => {
    const updates = [
      { seq: 2, update: new ArrayBuffer(1) },
      { seq: 7, update: new ArrayBuffer(1) },
    ]
    const runQuery = vi.fn().mockResolvedValue(updates)
    const runMutation = vi.fn().mockResolvedValue(null)
    yjsUpdatesToBlocks.mockReturnValue([])

    await expect(
      projectNoteBlocksFromYjs(actionContext(runQuery, runMutation), documentId),
    ).resolves.toEqual({ status: 'projected', throughSeq: 7 })
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
      noteId: documentId,
      content: [],
      campaignMemberId: undefined,
    })
  })
})

function actionContext(runQuery: ReturnType<typeof vi.fn>, runMutation: ReturnType<typeof vi.fn>) {
  return { runQuery, runMutation } as unknown as Pick<ActionCtx, 'runQuery' | 'runMutation'>
}
