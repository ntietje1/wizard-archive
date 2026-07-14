import {
  createWizardEditorResource,
  getWizardEditorNavigationCurrentResourceId,
} from '@wizard-archive/editor/adapter'
import { describe, expect, it, vi } from 'vite-plus/test'
import { act, render, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { CampaignMemberId, SidebarItemId } from 'shared/common/ids'
import type { LocalWorkspaceState } from '../local-workspace-model'
import { SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'
import { useInMemoryNoteSessionSource } from '../in-memory-note-session-source'
import { useLocalWorkspaceRuntime } from '../use-local-workspace-runtime'
import { createLocalRuntimeFileSystem, createLocalWorkspaceRuntime } from './helpers/local-runtime'
import type {
  WizardEditorItemWithContent,
  WizardEditorNoteEditorSession,
  WizardEditorRuntime,
} from '@wizard-archive/editor/adapter'
import { createImportFile } from './helpers/import-file'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '../public-demo-workspace-presets'

const TEST_RESOURCE_TYPES = {
  notes: 'note',
  gameMaps: 'gameMap',
  canvases: 'canvas',
} as const satisfies Record<string, WizardEditorItemWithContent['type']>
const TEST_PARENT_TARGET_KIND = {
  direct: 'direct',
} as const

type LocalNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>

describe('useLocalWorkspaceRuntime', () => {
  it('projects demo workspace state into the shared workspace runtime contract', async () => {
    const dispatch = vi.fn()
    const source = createLocalWorkspaceRuntime({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const filesystem = source.resources

    expect(source.resources.current.contentItem).toMatchObject({
      id: 'note-market',
      name: 'The Lantern Market',
      type: TEST_RESOURCE_TYPES.notes,
    })
    const sourceNote = source.resources.catalog.getKnownItemById('note-market' as SidebarItemId)
    expect(source.resources.current.contentItem).toBe(sourceNote)
    expect(source.resources.catalog.getKnownItemById('note-market' as SidebarItemId)).toBe(
      source.resources.current.contentItem,
    )
    expect(source.resources).toBe(filesystem)
    expect(source).not.toHaveProperty('filesystem')
    expect(source.sessions.note.document.useCollaborationSession).toEqual(expect.any(Function))
    expect(source.sessions.noteHeadings.headings.useNoteHeadings).toEqual(expect.any(Function))
    expect(source.sessions.noteValues.values.useNoteValueStates).toEqual(expect.any(Function))
    expect(source.resources.permissions.canEdit).toBe(true)
    expect(source.sharing.items).toEqual({
      status: 'unsupported',
      reason: 'not_available',
    })
    expect(source.sharing.viewAsParticipant).toEqual({
      status: 'unsupported',
      reason: 'not_available',
    })
    expect(source.search.items.status).toBe('available')
    if (source.search.items.status !== 'available') {
      throw new Error('Expected local search to be available')
    }
    expect(source.search.items.itemLinks.status).toBe('available')
    expect(source.history).toEqual({
      status: 'unsupported',
      reason: 'not_implemented',
    })

    await source.commands.operations.updateItemMetadata({
      item: source.resources.catalog.getKnownItemById('canvas-heist' as SidebarItemId)!,
      name: 'Board',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'canvas-heist',
      slug: 'board',
      title: 'Board',
    })

    const created = await source.commands.operations.createItem({
      type: TEST_RESOURCE_TYPES.notes,
      parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
      name: 'Local note',
    })
    expect(created).toEqual({ status: 'completed', id: 'local-note-2', slug: 'local-note-2' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'createItem',
      creation: expect.objectContaining({
        id: 'local-note-2',
        item: expect.objectContaining({
          id: 'local-note-2',
          parentId: null,
          type: 'note',
        }),
      }),
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-note-2',
      title: 'Local note',
    })
  })

  it('uses the local filesystem catalog for source current item lookup', async () => {
    const setNavigation = vi.fn()
    const source = createLocalWorkspaceRuntime({
      dispatch: vi.fn(),
      navigation: {
        kind: 'resource',
        resource: createWizardEditorResource('canvas-heist' as SidebarItemId),
      },
      setNavigation,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const catalogCanvas = source.resources.catalog.getKnownItemById('canvas-heist' as SidebarItemId)

    expect(source.resources.current.contentItem).toBe(catalogCanvas)
    expect(getWizardEditorNavigationCurrentResourceId(source.navigation)).toBe('canvas-heist')
    expect(source.resources.catalog.getKnownItemBySlug(catalogCanvas!.slug)).toBe(catalogCanvas)
    await source.navigation.openItem(createWizardEditorResource(catalogCanvas!.id))
    expect(setNavigation).toHaveBeenCalledWith({
      kind: 'resource',
      resource: createWizardEditorResource(catalogCanvas!.id),
    })

    const missingItemResult = await source.navigation.openItem(
      createWizardEditorResource('new-local-note' as SidebarItemId),
    )
    expect(setNavigation).toHaveBeenCalledTimes(1)
    expect(missingItemResult).toEqual({
      status: 'unavailable',
      reason: 'resource_not_visible',
    })
  })

  it('projects the local trash target into filesystem selection state', () => {
    const dispatch = vi.fn()
    const source = createLocalWorkspaceRuntime({
      dispatch,
      navigation: { kind: 'trash' },
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(source.navigation.current).toEqual({ kind: 'trash' })
  })

  it('keeps local note content scoped to editable note sessions', () => {
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    function Harness() {
      useInMemoryNoteSessionSource({
        user: SAMPLE_LOCAL_WORKSPACE.localUser,
      })

      expect(
        filesystem.operations.validateCreateItem({
          type: TEST_RESOURCE_TYPES.notes,
          name: 'New root note',
          parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
        }),
      ).toEqual({ valid: true })

      return createElement('span', { 'data-testid': 'note-content' }, 'ready')
    }

    render(createElement(Harness))
  })

  it('keeps local maps available through the runtime content cache', () => {
    const dispatch = vi.fn()
    const source = createLocalWorkspaceRuntime({
      dispatch,
      navigation: {
        kind: 'resource',
        resource: createWizardEditorResource('map-docks' as SidebarItemId),
      },
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(source.resources.current.availabilityState).toMatchObject({
      status: 'available',
      item: expect.objectContaining({
        id: 'map-docks',
        imageUrl: expect.stringContaining('data:image/svg+xml'),
        pins: expect.arrayContaining([
          expect.objectContaining({
            id: SAMPLE_LOCAL_WORKSPACE.mapsById['map-docks']!.pins[0]!.id,
            itemId: 'note-market',
          }),
        ]),
      }),
    })
    expect(source.resources.current.contentItem).toMatchObject({
      id: 'map-docks',
      type: TEST_RESOURCE_TYPES.gameMaps,
    })
  })

  it('imports local canvas image files through the runtime filesystem operation', async () => {
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({
        initialItemId: 'canvas-heist',
        initialWorkspace: SAMPLE_LOCAL_WORKSPACE,
        openExternalUrl: vi.fn(),
        reportCreateItemError: vi.fn(),
      }),
    )

    let uploadedItemId: SidebarItemId | null = null
    await act(async () => {
      const receipt = await result.current.commands.operations.importFile({
        file: createImportFile(['image'], 'portrait.png', { type: 'image/png' }),
        parentId: null,
      })
      if (receipt.status !== 'imported') {
        throw new Error(`Expected local image import to succeed, received ${receipt.status}`)
      }
      uploadedItemId = receipt.result.id
    })

    expect(uploadedItemId).toEqual(expect.any(String))
  })

  it('opens local canvas document sessions through the runtime content capability', () => {
    const { result } = renderHook(() => {
      const runtime = useLocalWorkspaceRuntime({
        initialItemId: 'canvas-heist',
        initialWorkspace: SAMPLE_LOCAL_WORKSPACE,
        openExternalUrl: vi.fn(),
        reportCreateItemError: vi.fn(),
      })
      const canvas = runtime.resources.current.contentItem
      if (canvas?.type !== TEST_RESOURCE_TYPES.canvases) {
        throw new Error('Expected selected demo item to be a canvas')
      }

      return runtime.sessions.canvas.document.useCanvasDocumentSession(canvas)
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      canvasId: 'canvas-heist',
      canEdit: true,
      collaboration: { status: 'unsupported' },
    })
    if (result.current.status !== 'ready') {
      throw new Error('Expected ready local canvas session')
    }
    expect(result.current.nodesMap.size).toBeGreaterThan(0)
  })

  it('makes local canvas sessions read-only while viewing as a player', () => {
    const playerScenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.playerPreview)
    const selectedParticipantId = playerScenario.workspace.selectedViewAsPlayerId
    if (!selectedParticipantId) {
      throw new Error('Expected public demo player preview to select a player')
    }
    const workspace: LocalWorkspaceState = {
      ...playerScenario.workspace,
      memberItemPermissionsById: {
        ...playerScenario.workspace.memberItemPermissionsById,
        'canvas-heist': {
          ...playerScenario.workspace.memberItemPermissionsById?.['canvas-heist'],
          [selectedParticipantId]: PERMISSION_LEVEL.VIEW,
        },
      },
    }
    const { result } = renderHook(() => {
      const runtime = useLocalWorkspaceRuntime({
        initialItemId: 'canvas-heist',
        initialWorkspace: workspace,
        openExternalUrl: vi.fn(),
        reportCreateItemError: vi.fn(),
      })
      const canvas = runtime.resources.current.contentItem
      if (canvas?.type !== TEST_RESOURCE_TYPES.canvases) {
        throw new Error('Expected selected public demo item to be a canvas')
      }

      return runtime.sessions.canvas.document.useCanvasDocumentSession(canvas)
    })

    expect(result.current).toMatchObject({
      status: 'ready',
      canvasId: 'canvas-heist',
      canEdit: false,
    })
  })

  it('keeps local editor mode state in the ephemeral runtime adapter', () => {
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({
        initialWorkspace: SAMPLE_LOCAL_WORKSPACE,
        openExternalUrl: vi.fn(),
        reportCreateItemError: vi.fn(),
      }),
    )

    expect(result.current.resources.permissions.workspaceMode).toBe(WORKSPACE_MODE.EDITOR)

    act(() => {
      result.current.resources.permissions.setWorkspaceMode(WORKSPACE_MODE.VIEWER)
    })

    expect(result.current.resources.permissions.workspaceMode).toBe(WORKSPACE_MODE.VIEWER)
  })

  it('switches the public prep scenario through the runtime view-as capability', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    const miraMemberId = scenario.workspace.playerMembers?.[0]?.id as unknown as CampaignMemberId
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({
        initialItemId: 'note-market',
        initialWorkspace: scenario.workspace,
        openExternalUrl: vi.fn(),
        reportCreateItemError: vi.fn(),
      }),
    )

    const gmNote = requireCurrentNote(result.current)
    expect(result.current.sharing.viewAsParticipant).toMatchObject({
      status: 'available',
      selectedParticipantId: undefined,
    })
    expect(gmNote.myPermissionLevel).toBe(PERMISSION_LEVEL.FULL_ACCESS)
    expect(getNoteText(gmNote.content)).toContain(
      'GM secret: Mara Vell planted the blue-glass invoice',
    )

    act(() => {
      const viewAsParticipant = result.current.sharing.viewAsParticipant
      if (viewAsParticipant.status !== 'available') {
        throw new Error('Expected public prep scenario to expose view-as player capability')
      }
      viewAsParticipant.setSelectedParticipantId(miraMemberId)
    })

    const playerNote = requireCurrentNote(result.current)
    expect(result.current.sharing.viewAsParticipant).toMatchObject({
      status: 'available',
      selectedParticipantId: miraMemberId,
    })
    expect(playerNote.myPermissionLevel).toBe(PERMISSION_LEVEL.VIEW)
    expect(
      result.current.resources.permissions.canAccessItem(playerNote, PERMISSION_LEVEL.VIEW),
    ).toBe(true)
    expect(
      playerNote.blockMeta[
        findNoteBlockByText(playerNote, 'GM secret: Mara Vell planted the blue-glass invoice').id
      ],
    ).toMatchObject({
      hiddenFrom: [miraMemberId],
    })
  })

  it('normalizes stale local view-as player ids back to DM actor state', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({
        initialItemId: 'note-market',
        initialWorkspace: {
          ...scenario.workspace,
          selectedViewAsPlayerId: 'missing-player' as CampaignMemberId,
        },
        openExternalUrl: vi.fn(),
        reportCreateItemError: vi.fn(),
      }),
    )

    const note = requireCurrentNote(result.current)

    expect(result.current.sharing.viewAsParticipant).toMatchObject({
      status: 'available',
      selectedParticipantId: undefined,
    })
    expect(note.myPermissionLevel).toBe(PERMISSION_LEVEL.FULL_ACCESS)
    expect(
      result.current.commands.operations.validateCreateItem({
        type: TEST_RESOURCE_TYPES.notes,
        name: 'Valid DM note',
        parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
      }),
    ).toEqual({ valid: true })
  })

  it('omits selected-player hidden note blocks from local search', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    const miraMemberId = scenario.workspace.playerMembers?.[0]?.id as unknown as CampaignMemberId
    const { result } = renderHook(() =>
      useLocalWorkspaceRuntime({
        initialItemId: scenario.initialItemId,
        initialWorkspace: scenario.workspace,
        openExternalUrl: vi.fn(),
        reportCreateItemError: vi.fn(),
      }),
    )

    act(() => {
      const viewAsParticipant = result.current.sharing.viewAsParticipant
      if (viewAsParticipant.status !== 'available') {
        throw new Error('Expected public prep scenario to expose view-as player capability')
      }
      viewAsParticipant.setSelectedParticipantId(miraMemberId)
    })

    const search = result.current.search.items
    if (search.status !== 'available') {
      throw new Error('Expected local search to be available')
    }

    expect(search.getSearchState({ query: 'GM secret' }).results).toEqual([])
  })

  it('keeps local note sessions in the note content source across editor remounts', () => {
    const sessions: Array<WizardEditorNoteEditorSession> = []
    const filesystem = createLocalRuntimeFileSystem({
      dispatch: vi.fn(),
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const note = filesystem.catalog.getKnownItemById(
      'note-market' as SidebarItemId,
    ) as LocalNoteItemWithContent

    function Harness({ show }: { show: boolean }) {
      const noteSession = useInMemoryNoteSessionSource({
        user: SAMPLE_LOCAL_WORKSPACE.localUser,
      })
      if (!show) return null

      const session = noteSession.document.useCollaborationSession({ mode: 'editable', note })
      sessions.push(session)

      return createElement('span', { 'data-testid': 'session' }, session.instanceId)
    }

    const { rerender } = render(createElement(Harness, { show: true }))
    const firstSession = sessions.at(-1)

    rerender(createElement(Harness, { show: false }))
    rerender(createElement(Harness, { show: true }))

    expect(sessions.at(-1)).toBe(firstSession)
  })
})

function requireCurrentNote(runtime: WizardEditorRuntime): LocalNoteItemWithContent {
  const item = runtime.resources.current.contentItem
  if (!item || item.type !== TEST_RESOURCE_TYPES.notes) {
    throw new Error('Expected current local runtime item to be a note')
  }
  return item as LocalNoteItemWithContent
}

function findNoteBlockByText(note: LocalNoteItemWithContent, text: string) {
  const block = note.content.find((candidate) => getNoteText(candidate).includes(text))
  if (!block) {
    throw new Error(`Expected note block containing "${text}"`)
  }
  return block
}

function getNoteText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(getNoteText).join('')
  }
  if (!value || typeof value !== 'object') return ''
  if ('text' in value && typeof value.text === 'string') {
    return value.text
  }
  return Object.values(value).map(getNoteText).join('')
}
