import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { canonicalizeResourceItemTitle, assertResourceItemSlug } from '../../workspace/items'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../workspace/items-persistence-contract'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'
import { useNoteValueRuntimeSource } from '../value-runtime'
import type { NoteValueReferences } from '../value-runtime-model'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { SidebarItemId, UserProfileId } from '../../../../../shared/common/ids'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import type { NoteValueRuntimeState } from '../values/state-contract'
import type { FolderItem } from '../../workspace/items'
import type { NoteItem } from '../../notes/item-contract'

describe('useNoteValueRuntimeSource', () => {
  it('keeps reference planning and state partitioning outside the React runtime hook', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/notes/value-runtime.ts'),
      'utf8',
    )

    expect(source).toContain("from './value-runtime-model'")
    expect(source).not.toContain("from './values/formula-parser'")
    expect(source).not.toContain('function getReferencedExternalNoteIds')
    expect(source).not.toContain('function uniqueSidebarItemIds')
    expect(source).not.toContain('externalDependencyNoteIds.includes')
    expect(source).not.toContain('referenceableNoteIds.includes')
  })

  it('extracts editor definitions and separates dependency states from referenceable candidates', () => {
    const noteId = sidebarItemId('note-1')
    const sourceNoteId = sidebarItemId('note-2')
    const unrelatedNoteId = sidebarItemId('note-3')
    const currentNote = noteItem(noteId, 'Current Note')
    const sourceNote = noteItem(sourceNoteId, 'Source Note')
    const unrelatedNote = noteItem(unrelatedNoteId, 'Unrelated Note')
    const persistedState = runtimeState({ noteId, valueId: 'value-1', formattedValue: '100' })
    const externalState = runtimeState({
      noteId: sourceNoteId,
      valueId: 'source-value-1',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    const unrelatedState = runtimeState({
      noteId: unrelatedNoteId,
      valueId: 'unrelated-value-1',
      slug: 'irrelevant',
      formattedValue: '999',
    })
    const stateSource = createStateSource({
      byNotes: new Map([
        [noteId, [persistedState]],
        [sourceNoteId, [externalState]],
        [unrelatedNoteId, [unrelatedState]],
      ]),
    })
    const runtime = createTestWorkspaceRuntime({
      activeItems: [currentNote, sourceNote, unrelatedNote],
    })
    const references = createRuntimeNoteValueReferences(runtime)

    const { result } = renderHook(() =>
      useNoteValueRuntimeSource({
        editor: createEditor('[[Source Note.prof_bonus]] + 1'),
        noteId,
        references,
        stateSource,
      }),
    )

    expect(result.current.noteId).toBe(noteId)
    expect(result.current.authoredDefinitions).toEqual([
      expect.objectContaining({
        noteId,
        valueId: 'value-1',
        slug: 'draft_total',
        expressionSource: '[[Source Note.prof_bonus]] + 1',
      }),
    ])
    expect(result.current.persistedStates).toEqual([persistedState])
    expect(result.current.externalDependencyStates).toEqual([externalState])
    expect(result.current.externalDependencyStatesStatus).toBe('success')
    expect(result.current.referenceableStates).toEqual([externalState, unrelatedState])
    expect(result.current.referenceableStatesStatus).toBe('success')
  })

  it.each(['pending', 'error'] as const)(
    'preserves the %s dependency load state separately from missing values',
    (status) => {
      const noteId = sidebarItemId('note-1')
      const sourceNoteId = sidebarItemId('note-2')
      const runtime = createTestWorkspaceRuntime({
        activeItems: [noteItem(noteId, 'Current Note'), noteItem(sourceNoteId, 'Source Note')],
      })

      const { result } = renderHook(() =>
        useNoteValueRuntimeSource({
          editor: createEditor('[[Source Note.prof_bonus]] + 1'),
          noteId,
          references: createRuntimeNoteValueReferences(runtime),
          stateSource: createStateSource({ status }),
        }),
      )

      expect(result.current.externalDependencyStates).toEqual([])
      expect(result.current.externalDependencyStatesStatus).toBe(status)
    },
  )

  it('loads candidate note value states for formula autocomplete before a formula references them', () => {
    const noteId = sidebarItemId('note-1')
    const sourceNoteId = sidebarItemId('note-2')
    const currentNote = noteItem(noteId, 'Current Note')
    const sourceNote = noteItem(sourceNoteId, 'Source Note')
    const externalState = runtimeState({
      noteId: sourceNoteId,
      valueId: 'source-value-1',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    const stateSource = createStateSource({
      byNotes: new Map([[sourceNoteId, [externalState]]]),
    })
    const runtime = createTestWorkspaceRuntime({
      activeItems: [currentNote, sourceNote],
    })

    const { result } = renderHook(() =>
      useNoteValueRuntimeSource({
        editor: createEditor('0'),
        noteId,
        references: createRuntimeNoteValueReferences(runtime),
        stateSource,
      }),
    )

    expect(stateSource.useNoteValueStates).toHaveBeenCalledWith([noteId, sourceNoteId])
    expect(result.current.externalDependencyStates).toEqual([])
    expect(result.current.referenceableStates).toEqual([externalState])
  })

  it('resolves relative external note references from visible workspace items', () => {
    const folder = folderItem(sidebarItemId('folder-1'), 'Lore')
    const noteId = sidebarItemId('note-1')
    const currentNote = noteItem(noteId, 'Current Note', folder.id)
    const sourceNote = noteItem(sidebarItemId('note-2'), 'Source Note', folder.id)
    const externalState = runtimeState({
      noteId: sourceNote.id,
      valueId: 'source-value-1',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    const stateSource = createStateSource({
      byNotes: new Map([[sourceNote.id, [externalState]]]),
    })
    const runtime = createTestWorkspaceRuntime({
      activeItems: [folder, currentNote, sourceNote],
    })
    const references = createRuntimeNoteValueReferences(runtime)

    const { result } = renderHook(() =>
      useNoteValueRuntimeSource({
        editor: createEditor('[[./Source Note.prof_bonus]] + 1'),
        noteId,
        references,
        stateSource,
      }),
    )

    expect(result.current.externalDependencyStates).toEqual([externalState])
    expect(result.current.referenceableStates).toEqual([externalState])
  })
})

function createRuntimeNoteValueReferences(
  runtime: ReturnType<typeof createTestWorkspaceRuntime>,
): NoteValueReferences {
  return {
    getNoteCandidates: () =>
      runtime.filesystem.catalog.queryVisibleItems({ type: RESOURCE_TYPES.notes }).map((item) => ({
        noteId: item.id,
        title: item.name,
        path: runtime.filesystem.paths.getVisibleItemLinkPath(item).join('/'),
      })),
    resolveNoteIdByPath: ({ notePathRaw, sourceNoteId }) =>
      runtime.filesystem.paths.resolveVisibleNotePath({
        text: notePathRaw,
        sourceItemId: sourceNoteId,
      })?.id ?? null,
  }
}

function createStateSource({
  byNotes = new Map(),
  status = 'success',
}: {
  byNotes?: Map<SidebarItemId, Array<NoteValueRuntimeState<SidebarItemId>>>
  status?: 'pending' | 'success' | 'error'
}) {
  return {
    useNoteValueStates: vi.fn((noteIds: Array<SidebarItemId>) => ({
      states: noteIds.flatMap((noteId) => byNotes.get(noteId) ?? []),
      status,
    })),
  }
}

function createEditor(expressionSource: string): CustomBlockNoteEditor {
  return {
    document: [
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'draft_total',
              expressionSource,
            },
          },
        ],
        children: [],
      },
    ],
    _tiptapEditor: {
      on: vi.fn(),
      off: vi.fn(),
    },
  } as unknown as CustomBlockNoteEditor
}

function folderItem(id: SidebarItemId, name: string): FolderItem {
  return {
    ...baseItem(id, name),
    inheritShares: true,
    type: RESOURCE_TYPES.folders,
  }
}

function noteItem(
  id: SidebarItemId,
  name: string,
  parentId: SidebarItemId | null = null,
): NoteItem {
  return {
    ...baseItem(id, name),
    parentId,
    type: RESOURCE_TYPES.notes,
  }
}

function baseItem(id: SidebarItemId, name: string) {
  return {
    id: id,
    createdAt: 1,
    campaignId: campaignId('campaign-1'),
    name: canonicalizeResourceItemTitle(name),
    iconName: null,
    color: null,
    slug: assertResourceItemSlug(name.toLowerCase().replaceAll(' ', '-')),
    parentId: null,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: userProfileId('user-1'),
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    isActive: true,
    isTrashed: false,
  }
}

function runtimeState(
  overrides: Partial<Extract<NoteValueRuntimeState<SidebarItemId>, { status: 'ok' }>> = {},
): NoteValueRuntimeState<SidebarItemId> {
  return {
    noteId: sidebarItemId('note-1'),
    noteBlockId: 'block-1',
    valueId: 'value-1',
    slug: 'draft_total',
    status: 'ok',
    rawValue: 3,
    formattedValue: '3',
    ...overrides,
  }
}

function sidebarItemId(id: string): SidebarItemId {
  return id as SidebarItemId
}

function campaignId(id: string) {
  return testCampaignId(id)
}

function userProfileId(id: string): UserProfileId {
  return id as UserProfileId
}
