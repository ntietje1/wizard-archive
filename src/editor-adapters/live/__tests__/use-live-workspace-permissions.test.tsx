import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import type {
  WizardEditorSortDirection,
  WizardEditorSortOrder,
} from '@wizard-archive/editor/adapter'
import type { CampaignActor, CampaignViewAsSelection } from 'shared/campaigns/actor'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { CampaignId, CampaignMemberId } from 'shared/common/ids'
import type { Id } from 'convex/_generated/dataModel'
import type { LiveWorkspacePreferences } from '../live-workspace-preferences'
import { useLiveSidebarItemAvailabilityState } from '../use-live-sidebar-item-availability-state'
import { useLiveWorkspaceMode } from '../use-live-workspace-mode'

interface MockMutationOptions {
  onMutate?: (args: unknown) => unknown
  onError?: (error: Error, args: unknown, context: unknown) => void
  onSettled?: (data: unknown, error: Error | null, args: unknown, context: unknown) => void
}

const campaignId = 'campaign_1' as CampaignId
const playerMemberId = 'member_1' as CampaignMemberId
const TEST_SORT_ORDERS = {
  Alphabetical: 'Alphabetical',
} as const satisfies Record<string, WizardEditorSortOrder>
const TEST_SORT_DIRECTIONS = {
  Ascending: 'Ascending',
} as const satisfies Record<string, WizardEditorSortDirection>

const campaignState = vi.hoisted(() => ({
  campaignId: 'campaign_1' as Id<'campaigns'> | undefined,
  isDm: false as boolean | undefined,
}))
const actorState = vi.hoisted(() => ({
  actor: { kind: 'player', campaignId: 'campaign_1' } as CampaignActor | null,
}))
const currentEditorState = vi.hoisted(() => ({
  data: null as LiveWorkspacePreferences | null,
}))
const membersState = vi.hoisted(() => ({
  data: [] as Array<CampaignMemberSummary> | undefined,
}))
const mutationCalls = vi.hoisted(
  () =>
    [] as Array<{
      args: { editorMode?: string }
      context: Promise<unknown>
      options: MockMutationOptions
    }>,
)
const viewAsState = vi.hoisted(() => ({
  setViewAsPlayer: vi.fn(),
  viewAsPlayer: null as CampaignViewAsSelection | null,
}))
const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (_query: unknown, args: { campaignId: string }) => ({
    queryKey: ['getCurrentEditor', args.campaignId],
  }),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    editors: {
      queries: { getCurrentEditor: 'getCurrentEditor' },
      mutations: { setCurrentEditor: 'setCurrentEditor' },
    },
  },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/campaigns/hooks/useCampaignActor', () => ({
  useCampaignActor: () => actorState.actor,
}))

vi.mock('~/features/campaigns/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => ({ data: membersState.data, isPending: false }),
}))

vi.mock('~/features/campaigns/state/campaign-view-as-store', () => ({
  useCampaignViewAsStore: (selector: (state: typeof viewAsState) => unknown) =>
    selector(viewAsState),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: (_mutation: unknown, options: MockMutationOptions) => ({
    mutate: (args: { editorMode?: string }) => {
      mutationCalls.push({
        args,
        context: Promise.resolve(options.onMutate?.(args)),
        options,
      })
    },
  }),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: () => ({ data: currentEditorState.data, status: 'success' }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: (...args: Array<unknown>) => handleErrorMock(...args),
}))

let queryClient: QueryClient

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('live workspace permission hooks', () => {
  beforeEach(() => {
    queryClient = createQueryClient()
    campaignState.campaignId = campaignId as Id<'campaigns'>
    campaignState.isDm = false
    actorState.actor = { kind: 'player', campaignId }
    currentEditorState.data = {
      editorMode: WORKSPACE_MODE.VIEWER,
      sortOrder: TEST_SORT_ORDERS.Alphabetical,
      sortDirection: TEST_SORT_DIRECTIONS.Ascending,
    }
    membersState.data = [campaignMember()]
    mutationCalls.length = 0
    viewAsState.viewAsPlayer = null
    viewAsState.setViewAsPlayer.mockReset()
    handleErrorMock.mockReset()
  })

  it('lets a read-only player store their workspace mode preference', () => {
    const note = createNote({
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    const { result } = renderHook(
      () => useLiveWorkspaceMode(note, (itemId) => (itemId === note.id ? note : null)),
      { wrapper },
    )

    expect(result.current).toMatchObject({
      canEdit: false,
      workspaceMode: WORKSPACE_MODE.VIEWER,
    })

    act(() => {
      result.current.setWorkspaceMode(WORKSPACE_MODE.EDITOR)
    })

    expect(mutationCalls.map((call) => call.args)).toEqual([{ editorMode: WORKSPACE_MODE.EDITOR }])
  })

  it('optimistically updates editor mode and rolls back on mutation failure', async () => {
    const previousPreferences = {
      editorMode: WORKSPACE_MODE.VIEWER,
      sortOrder: TEST_SORT_ORDERS.Alphabetical,
      sortDirection: TEST_SORT_DIRECTIONS.Ascending,
    }
    queryClient.setQueryData(['getCurrentEditor', campaignId], previousPreferences)
    actorState.actor = { kind: 'dm', campaignId }
    campaignState.isDm = true
    const note = createNote({
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })

    const { result } = renderHook(
      () => useLiveWorkspaceMode(note, (itemId) => (itemId === note.id ? note : null)),
      { wrapper },
    )

    await act(async () => {
      result.current.setWorkspaceMode(WORKSPACE_MODE.EDITOR)
      await mutationCalls[0].context
    })

    expect(queryClient.getQueryData(['getCurrentEditor', campaignId])).toMatchObject({
      editorMode: WORKSPACE_MODE.EDITOR,
      sortOrder: TEST_SORT_ORDERS.Alphabetical,
    })

    const concurrentlyUpdatedPreferences = {
      ...previousPreferences,
      editorMode: WORKSPACE_MODE.EDITOR,
      sortDirection: 'Descending' as WizardEditorSortDirection,
    }
    queryClient.setQueryData(['getCurrentEditor', campaignId], concurrentlyUpdatedPreferences)

    await act(async () => {
      mutationCalls[0].options.onError?.(
        new Error('mode update failed'),
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(queryClient.getQueryData(['getCurrentEditor', campaignId])).toEqual({
      ...concurrentlyUpdatedPreferences,
      editorMode: WORKSPACE_MODE.VIEWER,
    })
    expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error), 'Failed to update editor mode')
  })

  it('invalidates the workspace preference query captured when the mode update started', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const note = createNote({
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })
    actorState.actor = { kind: 'dm', campaignId }
    campaignState.isDm = true
    const { rerender, result } = renderHook(
      () => useLiveWorkspaceMode(note, (itemId) => (itemId === note.id ? note : null)),
      { wrapper },
    )

    await act(async () => {
      result.current.setWorkspaceMode(WORKSPACE_MODE.EDITOR)
      await mutationCalls[0].context
    })
    campaignState.campaignId = 'campaign_2' as Id<'campaigns'>
    rerender()
    await act(async () => {
      mutationCalls[0].options.onSettled?.(
        undefined,
        null,
        mutationCalls[0].args,
        await mutationCalls[0].context,
      )
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['getCurrentEditor', campaignId] })
  })

  it('does not write workspace mode while the DM is viewing as a player', () => {
    campaignState.isDm = true
    actorState.actor = { kind: 'dm_view_as', campaignId, memberId: playerMemberId }
    const note = createNote({
      campaignId,
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })

    const { result } = renderHook(
      () => useLiveWorkspaceMode(note, (itemId) => (itemId === note.id ? note : null)),
      { wrapper },
    )

    act(() => {
      result.current.setWorkspaceMode(WORKSPACE_MODE.EDITOR)
    })

    expect(mutationCalls).toEqual([])
  })

  it('uses player availability while the DM is viewing as a player', () => {
    campaignState.isDm = true
    actorState.actor = { kind: 'dm_view_as', campaignId, memberId: playerMemberId }
    const hiddenNote = createNote({ campaignId, name: 'Hidden GM note' })

    const { result } = renderHook(() =>
      useLiveSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: hiddenNote.id },
        metadataSource: {
          status: 'success',
          owner: {
            getItemById: (itemId) => (itemId === hiddenNote.id ? hiddenNote : null),
            getItemBySlug: () => hiddenNote,
          },
          participant: {
            getItemById: () => null,
            getItemBySlug: () => null,
          },
        },
        readableItem: undefined,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'not_found',
      label: 'Embedded item',
    })
  })

  it('names the viewed-as player when an item is not shared with them', () => {
    campaignState.isDm = true
    actorState.actor = { kind: 'dm_view_as', campaignId, memberId: playerMemberId }
    const playerCatalogNote = createNote({ campaignId, name: 'Player catalog note' })

    const { result } = renderHook(() =>
      useLiveSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: playerCatalogNote.id },
        metadataSource: {
          status: 'success',
          owner: {
            getItemById: () => null,
            getItemBySlug: () => null,
          },
          participant: {
            getItemById: (itemId) => (itemId === playerCatalogNote.id ? playerCatalogNote : null),
            getItemBySlug: () => playerCatalogNote,
          },
        },
        readableItem: undefined,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'not_shared',
      label: 'Player catalog note',
      message: "This item isn't shared with Mira.",
    })
  })

  it('uses a neutral viewed-as target while player members are unresolved', () => {
    campaignState.isDm = true
    actorState.actor = { kind: 'dm_view_as', campaignId, memberId: playerMemberId }
    membersState.data = undefined
    const playerCatalogNote = createNote({ campaignId, name: 'Player catalog note' })

    const { result } = renderHook(() =>
      useLiveSidebarItemAvailabilityState({
        lookup: { kind: 'id', id: playerCatalogNote.id },
        metadataSource: {
          status: 'success',
          owner: {
            getItemById: () => null,
            getItemBySlug: () => null,
          },
          participant: {
            getItemById: (itemId) => (itemId === playerCatalogNote.id ? playerCatalogNote : null),
            getItemBySlug: () => playerCatalogNote,
          },
        },
        readableItem: undefined,
        subject: 'item',
        fallbackLabel: 'Embedded item',
      }),
    )

    expect(result.current).toMatchObject({
      status: 'not_shared',
      message: "This item isn't shared with the selected player.",
    })
  })
})

function campaignMember(): CampaignMemberSummary {
  return {
    id: playerMemberId,
    createdAt: 1,
    userId: 'user_1' as CampaignMemberSummary['userId'],
    campaignId,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    userProfile: {
      name: 'Mira',
      username: 'mira' as never,
      imageUrl: null,
    },
  }
}
