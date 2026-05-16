import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBlocksShare } from '../useBlocksShare'
import { createCampaign } from '~/test/factories/campaign-factory'
import { createGameMap, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { NoteWithContent } from 'convex/notes/types'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())
const useCampaignMutationMock = vi.hoisted(() => vi.fn())
const currentItemState = vi.hoisted(() => ({
  item: null as unknown,
}))
const campaignState = vi.hoisted(() => ({
  campaign: null as unknown,
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    blocks: {
      queries: { getBlocksWithShares: 'getBlocksWithShares' },
    },
    blockShares: {
      mutations: {
        setBlocksShareStatus: 'setBlocksShareStatus',
        shareBlocks: 'shareBlocks',
        unshareBlocks: 'unshareBlocks',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: (...args: Array<unknown>) => useCampaignMutationMock(...args),
}))

vi.mock('~/features/sidebar/hooks/useCurrentItem', () => ({
  useCurrentItem: () => currentItemState,
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaign: { data: campaignState.campaign },
  }),
}))

describe('useBlocksShare', () => {
  beforeEach(() => {
    useCampaignQueryMock.mockReset()
    useCampaignMutationMock.mockReset()
    currentItemState.item = createGameMap({ _id: testId<'sidebarItems'>('canvas-id') })
    campaignState.campaign = createCampaign({ _id: testId<'campaigns'>('campaign-id') })
    useCampaignQueryMock.mockReturnValue({
      data: { blocks: [], playerMembers: [] },
      isPending: false,
    })
    useCampaignMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    })
  })

  it('queries block shares for the provided embedded note instead of the current canvas item', () => {
    const block = createBlock('block-1')
    const note = createNoteWithContent()
    const useBlocksShareForNote = useBlocksShare as unknown as (
      blocks: Array<CustomBlock>,
      note: NoteWithContent,
    ) => ReturnType<typeof useBlocksShare>

    renderHook(() => useBlocksShareForNote([block], note))

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getBlocksWithShares', {
      noteId: note._id,
      blockNoteIds: ['block-1'],
    })
  })
})

function createBlock(id: string): CustomBlock {
  return { id, type: 'paragraph', content: [] } as unknown as CustomBlock
}

function createNoteWithContent(): NoteWithContent {
  return {
    ...createNote({ _id: testId<'sidebarItems'>('embedded-note-id') }),
    ancestors: [],
    content: [],
    blockMeta: {},
  }
}
