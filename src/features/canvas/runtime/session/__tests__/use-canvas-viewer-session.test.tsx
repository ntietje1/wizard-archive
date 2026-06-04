import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { useCanvasViewerSession } from '../use-canvas-viewer-session'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import type { CanvasWithContent } from 'shared/canvases/types'
import type { CampaignActor } from 'shared/campaigns/actor'

const doc = vi.hoisted(() => ({
  getMap: vi.fn(() => new Map()),
}))

const collaborationMock = vi.hoisted(() =>
  vi.fn((_documentId: unknown, _user: unknown, _canEdit: unknown) => ({
    doc,
    provider: null,
    isLoading: false,
    error: null,
  })),
)

const actorState = vi.hoisted(() => ({
  campaignActor: {
    kind: 'dm',
    campaignId: 'campaign_1',
  } as CampaignActor,
}))

const filesystemState = vi.hoisted(() => ({
  allItemsById: new Map(),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    users: {
      queries: {
        getUserProfile: 'getUserProfile',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({
    data: { _id: testId<'userProfiles'>('user_1'), name: 'Mina', username: 'mina' },
    isLoading: false,
  }),
}))

vi.mock('~/shared/theme/context', () => ({
  useResolvedTheme: () => 'light',
}))

vi.mock('~/features/editor/hooks/useConvexYjsCollaboration', () => ({
  useConvexYjsCollaboration: (documentId: unknown, user: unknown, canEdit: unknown) =>
    collaborationMock(documentId, user, canEdit),
}))

vi.mock('~/features/campaigns/hooks/useCampaignActor', () => ({
  useCampaignActor: () => actorState.campaignActor,
}))

vi.mock('~/features/filesystem/useFileSystemReadModel', () => ({
  useFileSystemReadModel: () => filesystemState,
}))

describe('useCanvasViewerSession', () => {
  beforeEach(() => {
    collaborationMock.mockClear()
    doc.getMap.mockClear()
    actorState.campaignActor = { kind: 'dm', campaignId: testId<'campaigns'>('campaign_1') }
    filesystemState.allItemsById = new Map()
  })

  it('keeps DM view-as canvas collaboration read-only even when the viewed player has edit access', () => {
    const playerId = testId<'campaignMembers'>('player_1')
    const canvas = createCanvas({
      shares: [
        {
          _id: testId<'sidebarItemShares'>('canvas_share_1'),
          _creationTime: 1,
          campaignId: testId<'campaigns'>('campaign_1'),
          sidebarItemId: testId<'sidebarItems'>('canvas_1'),
          sidebarItemType: SIDEBAR_ITEM_TYPES.canvases,
          campaignMemberId: playerId,
          sessionId: null,
          permissionLevel: PERMISSION_LEVEL.EDIT,
        },
      ],
    })
    actorState.campaignActor = {
      kind: 'dm_view_as',
      campaignId: testId<'campaigns'>('campaign_1'),
      memberId: playerId,
    }
    filesystemState.allItemsById = new Map([[canvas._id, canvas]])

    const { result } = renderHook(() => useCanvasViewerSession(canvas))

    expect(result.current).toMatchObject({ status: 'ready', canEdit: false })
    expect(collaborationMock).toHaveBeenCalledWith(
      canvas._id,
      expect.objectContaining({ name: 'Mina' }),
      false,
    )
  })
})

function createCanvas(overrides: Partial<CanvasWithContent> = {}): CanvasWithContent {
  const { type: _type, ...baseItem } = createNote({
    _id: testId<'sidebarItems'>('canvas_1'),
    name: 'Canvas',
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  return {
    ...baseItem,
    type: SIDEBAR_ITEM_TYPES.canvases,
    ancestors: [],
    ...overrides,
  }
}
